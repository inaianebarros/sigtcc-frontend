import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo } from 'react';
import { useLoad } from '../hooks/useLoad';
import { paths } from '../navigation/paths';
import { AvailabilityField } from '../profile/AvailabilityField';
import { catalogName } from '../profile/catalogName';
import { CoursesField } from '../profile/CoursesField';
import {
  teacherChanges,
  teacherSchema,
  toTeacherFormValues,
} from '../profile/teacherForm';
import { ProfileEditor } from '../profile/ProfileEditor';
import { ProfileScreen } from '../profile/ProfileScreen';
import { ReadOnlyFacts } from '../profile/ReadOnlyFacts';
import { listInstitutes } from '../services/catalogService';
import {
  getTeacherProfile,
  updateTeacherProfile,
} from '../services/profileService';
import type { TeacherProfile } from '../services/profileService';

const FIELD_BY_API_FIELD = {
  full_name: 'fullName',
  course_ids: 'courseIds',
  area_ids: 'areaIds',
  is_available: 'isAvailable',
  articles: 'articles',
} as const;

const WITHOUT_INSTITUTE_MESSAGE =
  'Não foi possível abrir o seu perfil: o seu cadastro está sem instituto. Fale com a administração.';

function TeacherFacts({
  profile,
  instituteId,
}: {
  profile: TeacherProfile;
  instituteId: number;
}) {
  const institutes = useLoad(listInstitutes, 'institutes');
  return (
    <ReadOnlyFacts
      facts={[
        ['E-mail', profile.email],
        ['Matrícula', profile.registrationNumber],
        ['Instituto', catalogName(institutes, instituteId)],
      ]}
    />
  );
}

export function TeacherProfilePage() {
  const resolver = useMemo(() => zodResolver(teacherSchema()), []);
  return (
    <ProfileScreen
      loadProfile={getTeacherProfile}
      problemWith={(profile) =>
        profile.instituteId === null ? WITHOUT_INSTITUTE_MESSAGE : null
      }
    >
      {(profile, areas) => {
        const instituteId = profile.instituteId;
        if (instituteId === null) return null;
        return (
          <ProfileEditor
            profile={profile}
            areas={areas}
            resolver={resolver}
            toValues={toTeacherFormValues}
            toChanges={teacherChanges}
            save={updateTeacherProfile}
            fieldByApiField={FIELD_BY_API_FIELD}
            changePasswordPath={paths.teacherPassword}
            facts={<TeacherFacts profile={profile} instituteId={instituteId} />}
            extraFields={
              <>
                <CoursesField instituteId={instituteId} />
                <AvailabilityField />
              </>
            }
          />
        );
      }}
    </ProfileScreen>
  );
}
