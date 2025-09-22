import React, { useState, useEffect } from 'react';
import { Users, Star, Calendar, Award, RefreshCw, AlertCircle, Mail, User } from 'lucide-react';
import { apiRequest, API_ENDPOINTS } from '@/lib/api-config';
import { PageSkeleton } from './ui/PageSkeleton';

interface TeamMember {
  id: number;
  name: string;
  email: string;
  role: string;
  avatar: string;
  skills: string[];
  projects: number;
  rating: string;
  lastActive: string | null;
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
      setError(null);
      const response = await apiRequest(API_ENDPOINTS.TEAM);
      const data = await response.json();
      setTeamData(data);
    } catch (err) {
      console.error('Failed to load team data:', err);
      setError('خطا در بارگذاری اطلاعات تیم');
    } finally {
      setLoading(false);
    }
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      admin: 'مدیر',
      trainer: 'مربی',
      viewer: 'بیننده',
      user: 'کاربر'
    };
    return labels[role] || role;
  };

  const getRoleColor = (role: string) => {
    const colors: Record<string, string> = {
      admin: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      trainer: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      viewer: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      user: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    };
    return colors[role] || colors.user;
  };

  const formatLastActive = (lastActive: string | null) => {
    if (!lastActive) return 'هرگز';
    
    const date = new Date(lastActive);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'امروز';
    if (diffDays === 1) return 'دیروز';
    if (diffDays < 7) return `${diffDays} روز پیش`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} هفته پیش`;
    return date.toLocaleDateString('fa-IR');
  };

  if (loading) {
    return <PageSkeleton showHeader />;
  }

  if (!teamData) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600 dark:text-gray-400">اطلاعات تیم در دسترس نیست</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">تیم توسعه</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            اعضای تیم و آمار عملکرد
          </p>
        </div>
        <button
          onClick={loadTeamData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          بروزرسانی
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <p className="text-red-800 dark:text-red-200">{error}</p>
          </div>
        </div>
      )}

      {/* Team Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
              <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {teamData.stats.totalMembers.toLocaleString('fa-IR')}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">کل اعضا</div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
              <User className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {teamData.stats.activeMembers.toLocaleString('fa-IR')}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">فعال</div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center">
              <Award className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {teamData.stats.totalProjects.toLocaleString('fa-IR')}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">کل پروژه‌ها</div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900 rounded-lg flex items-center justify-center">
              <Award className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {teamData.stats.completedProjects.toLocaleString('fa-IR')}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">تکمیل شده</div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-100 dark:bg-yellow-900 rounded-lg flex items-center justify-center">
              <Star className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {teamData.stats.averageRating}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">میانگین امتیاز</div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900 rounded-lg flex items-center justify-center">
              <Calendar className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {teamData.stats.recentCommits.toLocaleString('fa-IR')}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">کامیت‌های اخیر</div>
            </div>
          </div>
        </div>
      </div>

      {/* Team Members */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">اعضای تیم</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teamData.members.map((member) => (
              <div key={member.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-lg font-bold">
                    {member.avatar || member.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 dark:text-white">{member.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Mail className="h-3 w-3 text-gray-500" />
                      <span className="text-sm text-gray-600 dark:text-gray-400">{member.email}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">نقش:</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(member.role)}`}>
                      {getRoleLabel(member.role)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">امتیاز:</span>
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 text-yellow-500" />
                      <span className="text-sm font-medium">{member.rating}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">پروژه‌ها:</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {member.projects.toLocaleString('fa-IR')}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">آخرین فعالیت:</span>
                    <span className="text-sm text-gray-900 dark:text-white">
                      {formatLastActive(member.lastActive)}
                    </span>
                  </div>

                  {member.skills.length > 0 && (
                    <div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">مهارت‌ها:</div>
                      <div className="flex flex-wrap gap-1">
                        {member.skills.map((skill, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default TeamPage;