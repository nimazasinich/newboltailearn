// PersianUtils.ts - Fixed version with proper error handling
export interface PersianCalendar {
  persianMonths: string[];
  persianDays: string[];
}

const persianCalendarData: PersianCalendar = {
  persianMonths: [
    'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
    'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
  ],
  persianDays: [
    'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه', 'شنبه'
  ]
};

export function formatPersianDate(date: Date | string | null | undefined): string {
  try {
    // Handle null/undefined cases
    if (!date) {
      return 'تاریخ نامشخص';
    }

    // Ensure date is a Date object
    const dateObj = date instanceof Date ? date : new Date(date);
    
    // Check if date is valid
    if (isNaN(dateObj.getTime())) {
      return 'تاریخ نامعتبر';
    }

    // Safe access to persianMonths with fallback
    const calendar = persianCalendarData;
    if (!calendar || !calendar.persianMonths || calendar.persianMonths.length === 0) {
      // Fallback to Gregorian format if Persian calendar data is missing
      return dateObj.toLocaleDateString('fa-IR');
    }

    // Convert Gregorian to Persian (simplified)
    const gregorianYear = dateObj.getFullYear();
    const gregorianMonth = dateObj.getMonth();
    const gregorianDay = dateObj.getDate();
    
    // Simple Persian conversion (you can replace with more accurate library)
    const persianYear = gregorianYear - 621;
    const persianMonth = calendar.persianMonths[gregorianMonth] || `ماه ${gregorianMonth + 1}`;
    
    return `${gregorianDay} ${persianMonth} ${persianYear}`;
    
  } catch (error) {
    console.error('Error formatting Persian date:', error);
    
    // Ultimate fallback - return today's date in Persian
    try {
      return new Date().toLocaleDateString('fa-IR');
    } catch (fallbackError) {
      return 'امروز';
    }
  }
}

export function formatPersianDuration(milliseconds: number): string {
  try {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${englishToPersianNumbers(days.toString())} روز`;
    } else if (hours > 0) {
      return `${englishToPersianNumbers(hours.toString())} ساعت`;
    } else if (minutes > 0) {
      return `${englishToPersianNumbers(minutes.toString())} دقیقه`;
    } else {
      return `${englishToPersianNumbers(seconds.toString())} ثانیه`;
    }
  } catch (error) {
    console.error('Error formatting Persian duration:', error);
    return 'نامشخص';
  }
}

export function formatPersianPercentage(value: number, decimals: number = 1): string {
  try {
    const formatted = value.toFixed(decimals);
    return `${englishToPersianNumbers(formatted)}٪`;
  } catch (error) {
    console.error('Error formatting Persian percentage:', error);
    return '۰٪';
  }
}

export function englishToPersianNumbers(text: string): string {
  const persianNumbers = {
    '0': '۰', '1': '۱', '2': '۲', '3': '۳', '4': '۴',
    '5': '۵', '6': '۶', '7': '۷', '8': '۸', '9': '۹'
  };
  
  return text.replace(/[0-9]/g, (match) => 
    persianNumbers[match as keyof typeof persianNumbers] || match
  );
}

export function getCurrentPersianDate(): string {
  return formatPersianDate(new Date());
}

export function safePersianFormat(date: any): string {
  // Extra safe wrapper
  try {
    if (!date) return 'نامشخص';
    return formatPersianDate(date);
  } catch (error) {
    console.warn('Persian date formatting failed:', error);
    return 'تاریخ';
  }
}

// Export the calendar data for other components
export const PersianCalendarData = persianCalendarData;