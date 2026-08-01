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
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
  const [manualInput, setManualInput] = useState(
    format(initialDate, 'yyyy-MM-dd')
  );

  // Sync internal state when prop changes
  React.useEffect(() => {
    if (selectedDate) {
      const parsed = selectedDate instanceof Date ? selectedDate : parseISO(selectedDate);
      if (isValid(parsed)) {
        setActiveSelectedDate(parsed);
        setManualInput(format(parsed, 'yyyy-MM-dd'));
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
    setManualInput(dateStr);
    if (onDateSelect) {
      onDateSelect(dateStr, day);
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualInput) return;
    const parsed = parseISO(manualInput);
    if (isValid(parsed)) {
      setCurrentMonth(parsed);
      setActiveSelectedDate(parsed);
      if (onDateSelect) {
        onDateSelect(manualInput, parsed);
      }
    }
  };

  const savedSet = useMemo(() => new Set(savedDates), [savedDates]);

  return (
    <div
      className={cn(
        'w-full bg-surface-elevated border border-surface-card/80 rounded-2xl p-4 text-prime font-sans shadow-antigravity-elevated select-none',
        className
      )}
    >
      {/* Calendar Header: Title & Navigation */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-surface-card/60">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 text-accent shrink-0" />
          <motion.h3
            key={format(currentMonth, 'yyyy-MM')}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sm font-semibold tracking-tight text-prime"
          >
            {format(currentMonth, 'MMMM yyyy')}
          </motion.h3>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleTodayClick}
            className="p-1.5 rounded-lg text-dim hover:text-prime hover:bg-surface-card transition-colors text-[11px] font-medium flex items-center gap-1 mr-1"
            title="Jump to Today"
          >
            <RotateCcw className="w-3 h-3 text-accent" />
            <span>Today</span>
          </button>
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-1.5 rounded-xl text-dim hover:text-prime hover:bg-surface-card transition-colors cursor-pointer"
            aria-label="Previous Month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleNextMonth}
            className="p-1.5 rounded-xl text-dim hover:text-prime hover:bg-surface-card transition-colors cursor-pointer"
            aria-label="Next Month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Weekday Labels Header */}
      <div className="grid grid-cols-7 gap-1 text-center mb-1">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((dayStr) => (
          <span
            key={dayStr}
            className="text-[10px] font-semibold uppercase tracking-wider text-dim py-1"
          >
            {dayStr}
          </span>
        ))}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {calendarDays.map((day) => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const isSelected = isSameDay(day, activeSelectedDate);
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isCurrentDay = isToday(day);
          const hasSavedEpisode = savedSet.has(dateKey);

          return (
            <button
              key={dateKey}
              type="button"
              onClick={() => handleDayClick(day)}
              className={cn(
                'relative h-8 w-8 mx-auto flex flex-col items-center justify-center rounded-full text-xs transition-all duration-150 cursor-pointer font-medium',
                {
                  // Selected Day: Exact theme accent background, white text, circular
                  'bg-accent text-accent-text font-bold shadow-md shadow-accent/25 scale-105 z-10':
                    isSelected,
                  // Unselected Today: Subtle ring + accent color text
                  'text-accent font-semibold ring-1 ring-accent/60 bg-accent/10 hover:bg-accent/20':
                    !isSelected && isCurrentDay,
                  // Regular current month day
                  'text-prime hover:bg-surface-card':
                    !isSelected && !isCurrentDay && isCurrentMonth,
                  // Outside current month day
                  'text-dim/40 hover:text-dim hover:bg-surface-card/40':
                    !isSelected && !isCurrentDay && !isCurrentMonth,
                }
              )}
            >
              <span>{format(day, 'd')}</span>

              {/* Episode availability dot indicator */}
              {hasSavedEpisode && !isSelected && (
                <span
                  className={cn(
                    'absolute bottom-0.5 w-1 h-1 rounded-full',
                    isCurrentDay ? 'bg-accent' : 'bg-emerald-400'
                  )}
                  title="Saved MarketCall Episode Available"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Manual Date Input & Quick Jump Bar */}
      <div className="mt-3 pt-3 border-t border-surface-card/60">
        <form onSubmit={handleManualSubmit} className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="date"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              className="w-full bg-surface-card border border-edge rounded-xl px-3 py-1.5 text-xs text-prime focus:outline-none focus:border-accent font-mono transition-colors"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-1.5 bg-surface-card hover:bg-surface-card/80 border border-edge text-prime text-xs font-semibold rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer shrink-0"
          >
            Load Date
          </button>
        </form>
      </div>
    </div>
  );
}

export default Calendar;
