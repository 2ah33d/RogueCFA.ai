import React from 'react';
import Calendar from './calendar';

/**
 * GlassCalendar wrapper styled for RogueCFA design system.
 * Uses soft grey background, circular date selector, and exact accent color.
 */
export const GlassCalendar = React.forwardRef(
  ({ selectedDate, onDateSelect, className, savedDates, ...props }, ref) => {
    return (
      <div ref={ref} className={className} {...props}>
        <Calendar
          selectedDate={selectedDate}
          onDateSelect={onDateSelect}
          savedDates={savedDates}
        />
      </div>
    );
  }
);

GlassCalendar.displayName = 'GlassCalendar';
export default GlassCalendar;
