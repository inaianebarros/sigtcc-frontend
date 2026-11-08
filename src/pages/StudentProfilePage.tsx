import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo } from 'react';
import { useLoad } from '../hooks/useLoad';
import { paths } from '../navigation/paths';
import { profileSchema, toFormValues } from '../profile/profileForm';
import { studentChanges } from '../profile/studentForm';
import { ProfileEditor } from '../profile/ProfileEditor';
import { ProfileScreen } from '../profile/ProfileScreen';
import { ReadOnlyFacts } from '../profile/ReadOnlyFacts';
import { catalogName } from '../profile/catalogName';
import { listCourses, listInstitutes } from '../services/catalogService';
import {
  getStudentProfile,
  updateStudentProfile,
} from '../services/profileService';
import type { StudentProfile } from '../services/profileService';

const FIELD_BY_API_FIELD = {
  full_name: 'fullName',
  area_ids: 'areaIds',
  articles: 'articles',
} as const;

function StudentFacts({ profile }: { profile: StudentProfile }) {
  const institutes = useLoad(listInstitutes, 'institutes');
  const courses = useLoad(
    () => listCourses(profile.instituteId),
    profile.instituteId,
  );
  return (
    <ReadOnlyFacts
      facts={[
        ['E-mail', profile.email],
        ['Matrícula', profile.registrationNumber],
        ['Instituto', catalogName(institutes, profile.instituteId)],
        ['Curso', catalogName(courses, profile.courseId)],
      ]}
    />
  );
}

export function StudentProfilePage() {
  const resolver = useMemo(() => zodResolver(profileSchema()), []);
  return (
    <ProfileScreen loadProfile={getStudentProfile}>
      {(profile, areas) => (
        <ProfileEditor
          profile={profile}
          areas={areas}
          resolver={resolver}
          toValues={toFormValues}
          toChanges={studentChanges}
          save={updateStudentProfile}
          fieldByApiField={FIELD_BY_API_FIELD}
          facts={<StudentFacts profile={profile} />}
          changePasswordPath={paths.studentPassword}
        />
      )}
    </ProfileScreen>
  );
}
