import { z } from 'zod';
import type {
  TeacherProfile,
  TeacherProfileChanges,
} from '../services/profileService';
import {
  commonChanges,
  isDirty,
  profileShape,
  sameSet,
  toFormValues,
} from './profileForm';
import type { DirtyFields, ProfileFormValues } from './profileForm';

export interface TeacherFormValues extends ProfileFormValues {
  courseIds: number[];
  isAvailable: boolean;
}

export function teacherSchema(currentYear = new Date().getFullYear()) {
  return z.object({
    ...profileShape(currentYear),
    courseIds: z.array(z.number()).min(1, 'Escolha ao menos um curso.'),
    isAvailable: z.boolean(),
  });
}

export function toTeacherFormValues(
  profile: TeacherProfile,
): TeacherFormValues {
  return {
    ...toFormValues(profile),
    courseIds: profile.courseIds,
    isAvailable: profile.isAvailable,
  };
}

export function teacherChanges(
  values: TeacherFormValues,
  dirtyFields: DirtyFields,
  baseline: TeacherProfile,
): TeacherProfileChanges {
  const changes: TeacherProfileChanges = commonChanges(
    values,
    dirtyFields,
    baseline,
  );
  if (
    isDirty(dirtyFields.courseIds) &&
    !sameSet(values.courseIds, baseline.courseIds)
  ) {
    changes.courseIds = values.courseIds;
  }
  if (
    isDirty(dirtyFields.isAvailable) &&
    values.isAvailable !== baseline.isAvailable
  ) {
    changes.isAvailable = values.isAvailable;
  }
  return changes;
}
