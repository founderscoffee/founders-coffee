/** Dev-only sample events for the discover-tabs design preview (import.meta.env.DEV-gated). */

export interface SampleEvent {
  readonly id: string
  readonly title: string
  readonly date: { readonly day_of_week: string; readonly day: number; readonly month: string }
  readonly time: string
  readonly location: { readonly venue: string; readonly city: string }
  readonly attendees: {
    readonly featured_names: readonly string[]
    readonly additional_count: number
  }
}

export const sampleEvents: readonly SampleEvent[] = [
  {
    id: '1',
    title: 'نقاش نمو المنتج: الجزائر العاصمة',
    date: { day_of_week: 'الخميس', day: 2, month: 'جويلية' },
    time: '6:30 مساءً',
    location: { venue: 'الجزائر العاصمة', city: 'باب الوادي' },
    attendees: { featured_names: ['أمين', 'سارة', 'يدير'], additional_count: 14 },
  },
  {
    id: '2',
    title: 'قهوة المؤسسين الأوائل — وهران',
    date: { day_of_week: 'السبت', day: 5, month: 'جويلية' },
    time: '10:00 صباحًا',
    location: { venue: 'وهران', city: 'وسط المدينة' },
    attendees: { featured_names: ['ليلى', 'كمال'], additional_count: 5 },
  },
  {
    id: '3',
    title: 'من الفكرة لأوّل عميل: جلسة مفتوحة',
    date: { day_of_week: 'الثلاثاء', day: 8, month: 'جويلية' },
    time: '7:00 مساءً',
    location: { venue: 'الجزائر العاصمة', city: 'حيدرة' },
    attendees: { featured_names: ['رحاب', 'سامي', 'يحيى'], additional_count: 8 },
  },
]
