import type { StudentProfile } from '../services/profileService';
import { commonChanges } from './profileForm';
import type { DirtyFields, ProfileFormValues } from './profileForm';

export function studentChanges(
  values: ProfileFormValues,
  dirtyFields: DirtyFields,
  baseline: StudentProfile,
) {
  return commonChanges(values, dirtyFields, baseline);
}
