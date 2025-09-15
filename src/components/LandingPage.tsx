import React from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Brain, ArrowLeft, Sparkles, Zap, Target } from "lucide-react";

export function LandingPage(): React.ReactElement {
  const navigate = useNavigate();

  const handleStart = () => {
    navigate("/app/dashboard");
  };

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 text-white flex items-center justify-center px-6 overflow-hidden"
      dir="rtl"
    >
      {/* Enhanced background patterns */}
      <div className="absolute inset-0 opacity-10">
        <div
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)",
            backgroundSize: "50px 50px",
          }}
          className="w-full h-full"
        />
      </div>

      {/* Animated floating elements */}
      <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-1/4 left-1/4 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
      <div className="absolute top-1/2 left-1/2 w-32 h-32 bg-pink-500/15 rounded-full blur-2xl animate-bounce delay-500"></div>

      {/* Main content */}
      <div className="relative z-10 text-center max-w-5xl">
        {/* Logo with enhanced animation */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0, rotate: -10 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 17 }}
          className="mb-12"
        >
          <div className="relative">
            <div className="w-20 h-20 mx-auto bg-gradient-to-r from-blue-500 via-purple-600 to-pink-500 rounded-2xl flex items-center justify-center shadow-2xl transform hover:scale-110 transition-transform duration-300">
              <Brain className="h-10 w-10 text-white" />
            </div>
            {/* Glow effect */}
            <div className="absolute inset-0 w-20 h-20 mx-auto bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl blur-md opacity-60 animate-pulse"></div>
          </div>
        </motion.div>

        {/* Main title with stagger animation */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.3 }}
          className="mb-8"
        >
          <h1 className="text-4xl md:text-7xl font-black mb-4 leading-tight">
            <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent animate-pulse">
              هوش مصنوعی حقوقی ایران
            </span>
          </h1>
          
          {/* Subtitle with icons */}
          <div className="flex items-center justify-center gap-4 text-2xl md:text-3xl font-bold text-gray-300 mb-8">
            <Sparkles className="w-8 h-8 text-yellow-400 animate-spin" />
            <span>نسل جدید قضاوت هوشمند</span>
            <Zap className="w-8 h-8 text-blue-400 animate-pulse" />
          </div>
        </motion.div>

        {/* Enhanced description */}
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="text-xl md:text-2xl text-gray-200 mb-16 max-w-4xl mx-auto leading-relaxed"
        >
          آموزش مدل‌های پیشرفته با قوانین جمهوری اسلامی ایران
          <br />
          <span className="text-blue-300 font-semibold">دقت بالا • سرعت فوق‌العاده • قابلیت اعتماد کامل</span>
        </motion.p>

        {/* Enhanced stats with icons */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.9 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16 max-w-4xl mx-auto"
        >
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 hover:scale-105 transition-all duration-300">
            <div className="text-4xl font-black text-blue-400 mb-2">۵۶۰K+</div>
            <div className="text-gray-300 text-lg font-medium">داده حقوقی</div>
            <div className="flex justify-center mt-3">
              <div className="w-12 h-1 bg-gradient-to-r from-blue-400 to-blue-600 rounded-full"></div>
            </div>
          </div>
          
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 hover:scale-105 transition-all duration-300">
            <div className="text-4xl font-black text-purple-400 mb-2">۱۵+</div>
            <div className="text-gray-300 text-lg font-medium">مدل آموزش‌دیده</div>
            <div className="flex justify-center mt-3">
              <div className="w-12 h-1 bg-gradient-to-r from-purple-400 to-purple-600 rounded-full"></div>
            </div>
          </div>
          
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 hover:scale-105 transition-all duration-300">
            <div className="text-4xl font-black text-pink-400 mb-2">۹۴%</div>
            <div className="text-gray-300 text-lg font-medium">دقت مدل</div>
            <div className="flex justify-center mt-3">
              <div className="w-12 h-1 bg-gradient-to-r from-pink-400 to-pink-600 rounded-full"></div>
            </div>
          </div>
        </motion.div>

        {/* Enhanced CTA Button */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 1.2 }}
        >
          <button
            onClick={handleStart}
            className="group relative px-16 py-5 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 rounded-full text-xl font-bold transition-all duration-500 hover:scale-110 shadow-2xl hover:shadow-3xl transform-gpu"
          >
            {/* Button glow effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-pink-600 rounded-full blur opacity-60 group-hover:opacity-80 transition-opacity"></div>
            
            <span className="relative flex items-center gap-4">
              <Target className="w-6 h-6 group-hover:rotate-12 transition-transform" />
              شروع آموزش
              <ArrowLeft className="w-6 h-6 group-hover:-translate-x-2 transition-transform" />
            </span>
            
            {/* Ripple effect */}
            <div className="absolute inset-0 rounded-full bg-white/20 opacity-0 group-active:opacity-100 group-active:scale-110 transition-all duration-200"></div>
          </button>
        </motion.div>

        {/* Additional features showcase */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1.5 }}
          className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto text-center"
        >
          <div className="text-gray-400">
            <div className="text-3xl mb-2">⚡</div>
            <div className="font-semibold">پردازش سریع</div>
            <div className="text-sm">تحلیل آنی اسناد</div>
          </div>
          
          <div className="text-gray-400">
            <div className="text-3xl mb-2">🔒</div>
            <div className="font-semibold">امنیت بالا</div>
            <div className="text-sm">محافظت کامل داده‌ها</div>
          </div>
          
          <div className="text-gray-400">
            <div className="text-3xl mb-2">📊</div>
            <div className="font-semibold">گزارش جامع</div>
            <div className="text-sm">آنالیز دقیق نتایج</div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}