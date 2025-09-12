#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting Persian Legal AI Training System...\n');

// Start backend server
console.log('📡 Starting backend server...');
const backend = spawn('node', ['server/index.js'], {
  cwd: path.resolve(__dirname),
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'development' }
});

// Wait a bit for backend to start
setTimeout(() => {
  console.log('🎨 Starting frontend development server...');
  
  // Start frontend development server
  const frontend = spawn('npm', ['run', 'dev'], {
    cwd: path.resolve(__dirname),
    stdio: 'inherit',
    shell: true
  });

  // Handle process termination
  const cleanup = () => {
    console.log('\n🛑 Shutting down servers...');
    backend.kill('SIGTERM');
    frontend.kill('SIGTERM');
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  frontend.on('error', (err) => {
    console.error('Frontend error:', err);
  });

}, 2000);

backend.on('error', (err) => {
  console.error('Backend error:', err);
});

console.log('\n📊 System will be available at:');
console.log('   Frontend: http://localhost:5173');
console.log('   Backend:  http://localhost:3001');
console.log('   API:      http://localhost:3001/api');
console.log('\n💡 Press Ctrl+C to stop all servers\n');