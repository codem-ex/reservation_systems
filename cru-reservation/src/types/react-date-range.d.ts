declare module 'react-date-range' {
    import { Component } from 'react';

    export interface Range {
        startDate?: Date;
        endDate?: Date;
        key?: string;
        color?: string;
        autoFocus?: boolean;
        disabled?: boolean;
        showDateDisplay?: boolean;
    }

    export interface RangeKeyDict {
        [key: string]: Range;
    }

    export interface DateRangeProps {
        ranges?: Range[];
        onChange?: (item: RangeKeyDict) => void;
        focusedRange?: [number, number];
        showDateDisplay?: boolean;
        months?: number;
        direction?: string;
        rangeColors?: string[];
        minDate?: Date;
        maxDate?: Date;
        locale?: any;
        disabledDates?: Date[];
        dayContentRenderer?: (day: Date) => any;
    }

    export class DateRange extends Component<DateRangeProps> { }
}
