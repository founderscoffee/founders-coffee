import {
  closeout_friction_attendance,
  closeout_friction_format,
  closeout_friction_other_structured,
  closeout_friction_promotion,
  closeout_friction_safety,
  closeout_friction_scheduling,
  closeout_friction_venue,
  type Locale,
} from '@founders-coffee/i18n';

/**
 * The label for a friction category.
 *
 * A lookup rather than a constructed key, because Paraglide compiles one function per message and a
 * template built at runtime would resolve to nothing at all — silently, as an empty label beside a
 * checkbox a host is being asked to tick.
 */
export const frictionLabel = (friction: string, locale: Locale): string => {
  const options = { locale };
  if (friction === 'venue') return closeout_friction_venue({}, options);
  if (friction === 'scheduling')
    return closeout_friction_scheduling({}, options);
  if (friction === 'promotion') return closeout_friction_promotion({}, options);
  if (friction === 'attendance')
    return closeout_friction_attendance({}, options);
  if (friction === 'format') return closeout_friction_format({}, options);
  if (friction === 'safety') return closeout_friction_safety({}, options);
  return closeout_friction_other_structured({}, options);
};
