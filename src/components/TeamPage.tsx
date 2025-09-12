import React, { useState, useEffect } from 'react';
import { Users, Mail, Github, Linkedin, Star, Award, RefreshCw } from 'lucide-react';
import { apiClient } from '../services/api';

interface TeamMember {
  id: number;
  name: string;
  role: string;
  email: string;
  avatar: string;
  skills: string[];
  projects: number;
  rating: string;
  lastActive?: string;
}

interface TeamStats {
  totalMembers: number;
  activeMembers: number;
  totalProjects: number;
  completedProjects: number;
  averageRating: string;
  recentCommits: number;
}

interface TeamData {
  members: TeamMember[];
  stats: TeamStats;
}

export function TeamPage() {
  const [teamData, setTeamData] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTeamData();
  }, []);

  const loadTeamData = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getTeam();
      setTeamData(data);
    } catch (err) {
      console.error('Failed to load team data:', err);
      setError('خطا در بارگذاری اطلاعات تیم');
    } finally {
      setLoading(false);
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'مدیر پروژه';
      case 'trainer': return 'متخصص هوش مصنوعی';
      case 'viewer': return 'تحلیل‌گر داده';
      default: return role;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !teamData) {
    return (
      <div className="text-center py-12">
        <div className="text-red-500 dark:text-red-400 mb-4">
          {error || 'خطا در بارگذاری اطلاعات تیم'}
        </div>
        <button
          onClick={loadTeamData}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 mx-auto"
        >
          <RefreshCw className="h-4 w-4" />
          تلاش مجدد
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8" dir="rtl">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="text-center flex-1">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Users className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              تیم توسعه
            </h1>
          </div>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            تیم متخصص ما در زمینه هوش مصنوعی و حقوق برای ارائه بهترین خدمات به شما تلاش می‌کند
          </p>
        </div>
        <button
          onClick={loadTeamData}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          بروزرسانی
        </button>
      </div>

      {/* Team Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
              <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{teamData.stats.totalMembers}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">اعضای تیم</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
              <Award className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{teamData.stats.completedProjects}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">پروژه تکمیل شده</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center">
              <Star className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{teamData.stats.averageRating}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">میانگین رتبه</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900 rounded-lg flex items-center justify-center">
              <Github className="h-6 w-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{teamData.stats.recentCommits}+</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">کامیت در ماه</p>
            </div>
          </div>
        </div>
      </div>

      {/* Team Members */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
        {teamData.members.map((member) => (
          <div key={member.id} className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-start gap-4">
              {/* Avatar */}
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-2xl">
                {member.avatar}
              </div>

              {/* Info */}
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                  {member.name}
                </h3>
                <p className="text-blue-600 dark:text-blue-400 text-sm mb-2">
                  {getRoleLabel(member.role)}
                </p>
                
                {/* Contact */}
                <div className="flex items-center gap-2 mb-3">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {member.email}
                  </span>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 mb-3">
                  <div className="flex items-center gap-1">
                    <Award className="h-4 w-4 text-green-500" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {member.projects} پروژه
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 text-yellow-500" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {member.rating}
                    </span>
                  </div>
                </div>

                {/* Last Active */}
                {member.lastActive && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                    آخرین فعالیت: {new Date(member.lastActive).toLocaleDateString('fa-IR')}
                  </div>
                )}

                {/* Skills */}
                <div className="flex flex-wrap gap-2">
                  {member.skills.map((skill, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded-md"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Contact Section */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 p-8 rounded-xl border border-blue-200 dark:border-blue-800">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            با تیم ما در تماس باشید
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            برای همکاری، سوالات یا پیشنهادات خود با ما تماس بگیرید
          </p>
          <div className="flex justify-center gap-4">
            <a
              href="mailto:team@legal-ai.ir"
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <Mail className="h-5 w-5" />
              ارسال ایمیل
            </a>
            <a
              href="#"
              className="flex items-center gap-2 px-6 py-3 bg-gray-800 hover:bg-gray-900 text-white rounded-lg transition-colors"
            >
              <Github className="h-5 w-5" />
              گیت‌هاب
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}