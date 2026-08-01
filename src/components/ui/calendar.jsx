import React, { useState, useMemo } from 'react';
import {
  format,
  addMonths,
  subMonths,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  parseISO,
  isValid,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

export function Calendar({
  selectedDate,
  onDateSelect,
  savedDates = [],
  className = '',
}) {
  // Parse initial selected date or default to today
  const initialDate = useMemo(() => {
    if (!selectedDate) return new Date();
    if (selectedDate instanceof Date) return selectedDate;
    const parsed = parseISO(selectedDate);
    return isValid(parsed) ? parsed : new Date();
  }, [selectedDate]);

  const [currentMonth, setCurrentMonth] = useState(initialDate);
  const [activeSelectedDate, setActiveSelectedDate] = useState(initialDate);

  // Sync internal state when prop changes
  React.useEffect(() => {
    if (selectedDate) {
      const parsed = selectedDate instanceof Date ? selectedDate : parseISO(selectedDate);
      if (isValid(parsed)) {
        setActiveSelectedDate(parsed);
      }
    }
  }, [selectedDate]);

  // Generate complete grid interval (including padding days from prev/next months)
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [currentMonth]);

  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const handleTodayClick = () => {
    const today = new Date();
    setCurrentMonth(today);
    handleDayClick(today);
  };

  const handleDayClick = (day) => {
    setActiveSelectedDate(day);
    const dateStr = format(day, 'yyyy-MM-dd');
    if (onDateSelect) {
      onDateSelect(dateStr, day);
    }
  };

  const savedSet = useMemo(() => new Set(savedDates), [savedDates]);

  return (
    <div
      className={cn(
        'w-80 bg-surface-elevated border border-surface-card/90 rounded-2xl p-4 text-prime font-sans shadow-antigravity-elevated select-none',
        className
      )}
    >
      {/* Calendar Header: Month, Year, Today & Arrows — Symmetrical spacing */}
      <div className="flex items-center justify-between mb-3 pb-3 border-b border-surface-card/70">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 text-accent shrink-0" />
          <motion.h3
            key={format(currentMonth, 'yyyy-MM')}
            initial={{ opacity: 0, y: -3 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sm font-bold tracking-tight text-white"
          >
            {format(currentMonth, 'MMMM yyyy')}
          </motion.h3>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleTodayClick}
            className="px-2.5 py-1 rounded-lg text-accent hover:text-accent-hover hover:bg-surface-card transition-colors text-xs font-semibold cursor-pointer mr-1"
            title="Jump to Today"
          >
            Today
          </button>
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-1 rounded-lg text-dim hover:text-white hover:bg-surface-card transition-colors cursor-pointer"
            aria-label="Previous Month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleNextMonth}
            className="p-1 rounded-lg text-dim hover:text-white hover:bg-surface-card transition-colors cursor-pointer"
            aria-label="Next Month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Weekday Header */}
      <div className="grid grid-cols-7 gap-1 text-center mb-1">
        {['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'].map((dayStr) => (
          <span
            key={dayStr}
            className="text-[10px] font-bold uppercase tracking-wider text-dim/70 py-0.5"
          >
            {dayStr}
          </span>
        ))}
      </div>

      {/* Days Grid — Clean fixed cell layout to guarantee symmetric top & bottom padding */}
      <div className="grid grid-cols-7 gap-y-1 gap-x-1 text-center pb-1">
        {calendarDays.map((day) => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const isSelected = isSameDay(day, activeSelectedDate);
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isCurrentDay = isToday(day);
          const hasSavedEpisode = savedSet.has(dateKey);

          return (
            <div
              key={dateKey}
              className="flex flex-col items-center justify-start h-10 w-full"
            >
              {/* Circular Day Button */}
              <button
                type="button"
                onClick={() => handleDayClick(day)}
                className={cn(
                  'h-7.5 w-7.5 rounded-full text-xs font-semibold flex items-center justify-center transition-all duration-150 cursor-pointer',
                  {
                    // 1. Selected Day: Solid accent background with white text & subtle glow
                    'bg-accent text-accent-text font-bold shadow-md shadow-accent/30 scale-105 z-10':
                      isSelected,

                    // 2. Today (when unselected): High-contrast crisp white text with a solid accent border
                    'text-white font-bold border-2 border-accent bg-surface-card':
                      !isSelected && isCurrentDay,

                    // 3. Regular day in current month
                    'text-white/90 hover:bg-surface-card hover:text-white':
                      !isSelected && !isCurrentDay && isCurrentMonth,

                    // 4. Day outside current month
                    'text-dim/35 hover:text-dim hover:bg-surface-card/40':
                      !isSelected && !isCurrentDay && !isCurrentMonth,
                  }
                )}
              >
                {format(day, 'd')}
              </button>

              {/* Dedicated Dot Container below circle (NEVER overlaps circle border) */}
              <div className="h-2 flex items-center justify-center mt-0.5">
                {hasSavedEpisode && (
                  <span
                    className={cn(
                      'w-1.25 h-1.25 rounded-full transition-colors',
                      isSelected ? 'bg-accent' : 'bg-emerald-400 shadow-sm shadow-emerald-400/50'
                    )}
                    title="Saved Episode Available"
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default Calendar;
