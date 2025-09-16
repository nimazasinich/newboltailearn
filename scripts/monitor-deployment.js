#!/usr/bin/env node
/**
 * Deployment monitoring script with automated rollback triggers
 * Monitors health endpoint and triggers alerts/rollbacks on failures
 */

import https from 'https';
import http from 'http';

const RENDER_URL = process.env.RENDER_URL || 'http://localhost:3000';
const WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL; // Optional: Slack notifications
const MAX_FAILURES = parseInt(process.env.MAX_FAILURES) || 3;
const CHECK_INTERVAL = parseInt(process.env.CHECK_INTERVAL) || 60000; // 1 minute
const REQUIRED_SUCCESSES = parseInt(process.env.REQUIRED_SUCCESSES) || 5;

/**
 * Check health endpoint
 */
async function checkHealth() {
  return new Promise((resolve, reject) => {
    const url = new URL(`${RENDER_URL}/health`);
    const client = url.protocol === 'https:' ? https : http;
    
    const req = client.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const health = JSON.parse(data);
          resolve({
            statusCode: res.statusCode,
            health: health,
            isHealthy: res.statusCode === 200 && (health.status === 'healthy' || health.status === 'degraded')
          });
        } catch (error) {
          reject(new Error(`Invalid JSON response: ${error.message}`));
        }
      });
    });
    
    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

/**
 * Send notification (if webhook configured)
 */
async function sendNotification(message, type = 'info') {
  if (!WEBHOOK_URL) return;
  
  const color = type === 'error' ? '#ff0000' : type === 'warning' ? '#ffaa00' : '#00ff00';
  const emoji = type === 'error' ? '🚨' : type === 'warning' ? '⚠️' : '✅';
  
  const payload = {
    text: `${emoji} Deployment Monitor`,
    attachments: [{
      color: color,
      text: message,
      ts: Math.floor(Date.now() / 1000)
    }]
  };
  
  try {
    const url = new URL(WEBHOOK_URL);
    const client = url.protocol === 'https:' ? https : http;
    
    const data = JSON.stringify(payload);
    
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };
    
    const req = client.request(options);
    req.write(data);
    req.end();
    
  } catch (error) {
    console.error('Failed to send notification:', error.message);
  }
}

/**
 * Monitor deployment health
 */
async function monitorDeployment() {
  let failureCount = 0;
  let consecutiveSuccesses = 0;
  let lastHealthData = null;
  
  console.log('🔍 Starting deployment monitoring...');
  console.log(`📍 Target URL: ${RENDER_URL}`);
  console.log(`⚙️ Config: Max failures: ${MAX_FAILURES}, Check interval: ${CHECK_INTERVAL}ms, Required successes: ${REQUIRED_SUCCESSES}`);
  
  await sendNotification(`Deployment monitoring started for ${RENDER_URL}`);
  
  const monitor = setInterval(async () => {
    try {
      const result = await checkHealth();
      lastHealthData = result.health;
      
      if (result.isHealthy) {
        if (failureCount > 0) {
          console.log(`🔄 Recovery detected after ${failureCount} failures`);
          await sendNotification(`Service recovered after ${failureCount} failures`, 'info');
        }
        
        failureCount = 0;
        consecutiveSuccesses++;
        
        const statusEmoji = result.health.status === 'healthy' ? '✅' : '🟡';
        console.log(`${statusEmoji} Health check passed (${consecutiveSuccesses}/${REQUIRED_SUCCESSES}) - Status: ${result.health.status}`);
        
        if (consecutiveSuccesses >= REQUIRED_SUCCESSES) {
          console.log('🎉 Deployment stable - monitoring complete');
          await sendNotification('Deployment validation completed successfully! All systems stable.', 'info');
          clearInterval(monitor);
          process.exit(0);
        }
      } else {
        consecutiveSuccesses = 0;
        failureCount++;
        
        const errorDetails = {
          statusCode: result.statusCode,
          status: result.health?.status || 'unknown',
          error: result.health?.error || 'No error details',
          nodeVersion: result.health?.node_version,
          abiVersion: result.health?.abi_version,
          databaseConnected: result.health?.database?.connected
        };
        
        console.error(`❌ Health check failed (${failureCount}/${MAX_FAILURES}):`, errorDetails);
        
        if (failureCount === 1) {
          await sendNotification(`First health check failure detected: ${errorDetails.error}`, 'warning');
        }
        
        if (failureCount >= MAX_FAILURES) {
          const criticalMessage = `🚨 CRITICAL: ${failureCount} consecutive failures detected!\\n` +
            `Status Code: ${errorDetails.statusCode}\\n` +
            `Service Status: ${errorDetails.status}\\n` +
            `Error: ${errorDetails.error}\\n` +
            `Node Version: ${errorDetails.nodeVersion}\\n` +
            `ABI Version: ${errorDetails.abiVersion}\\n` +
            `Database: ${errorDetails.databaseConnected ? 'Connected' : 'Disconnected'}\\n\\n` +
            `**ROLLBACK REQUIRED**`;
          
          console.error('🚨 DEPLOYMENT FAILURE - ROLLBACK REQUIRED');
          console.error('📊 Final health data:', JSON.stringify(lastHealthData, null, 2));
          
          await sendNotification(criticalMessage, 'error');
          
          clearInterval(monitor);
          process.exit(1);
        }
      }
    } catch (error) {
      consecutiveSuccesses = 0;
      failureCount++;
      
      console.error(`❌ Health check error (${failureCount}/${MAX_FAILURES}):`, error.message);
      
      if (failureCount >= MAX_FAILURES) {
        const criticalMessage = `🚨 CRITICAL: ${failureCount} consecutive health check errors!\\n` +
          `Error: ${error.message}\\n\\n` +
          `**ROLLBACK REQUIRED**`;
        
        console.error('🚨 DEPLOYMENT FAILURE - ROLLBACK REQUIRED');
        await sendNotification(criticalMessage, 'error');
        
        clearInterval(monitor);
        process.exit(1);
      }
    }
  }, CHECK_INTERVAL);
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\\n🛑 Monitoring stopped by user');
    clearInterval(monitor);
    await sendNotification('Deployment monitoring stopped manually', 'warning');
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    console.log('\\n🛑 Monitoring terminated');
    clearInterval(monitor);
    await sendNotification('Deployment monitoring terminated', 'warning');
    process.exit(0);
  });
}

/**
 * Single health check mode
 */
async function singleHealthCheck() {
  try {
    console.log('🔍 Running single health check...');
    const result = await checkHealth();
    
    console.log('📊 Health Check Results:');
    console.log(JSON.stringify(result.health, null, 2));
    
    if (result.isHealthy) {
      console.log('✅ Service is healthy');
      process.exit(0);
    } else {
      console.log(`❌ Service is unhealthy: ${result.health?.error || 'Unknown error'}`);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    process.exit(1);
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];
  
  switch (command) {
    case 'monitor':
      monitorDeployment().catch(error => {
        console.error('❌ Monitoring failed:', error);
        process.exit(1);
      });
      break;
      
    case 'check':
      singleHealthCheck();
      break;
      
    default:
      console.log('Usage:');
      console.log('  node monitor-deployment.js monitor  # Start continuous monitoring');
      console.log('  node monitor-deployment.js check    # Single health check');
      console.log('');
      console.log('Environment variables:');
      console.log('  RENDER_URL           - Target URL (default: http://localhost:3000)');
      console.log('  SLACK_WEBHOOK_URL    - Slack webhook for notifications (optional)');
      console.log('  MAX_FAILURES         - Max failures before rollback trigger (default: 3)');
      console.log('  CHECK_INTERVAL       - Check interval in ms (default: 60000)');
      console.log('  REQUIRED_SUCCESSES   - Required consecutive successes (default: 5)');
      process.exit(1);
  }
}