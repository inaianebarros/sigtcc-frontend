import type { ReactElement } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { RequireAuth } from './components/RequireAuth';
import { areas } from './navigation/areas';
import { paths } from './navigation/paths';
import { AdvisorsPage } from './pages/AdvisorsPage';
import { AreaPage } from './pages/AreaPage';
import { ChangePasswordPage } from './pages/ChangePasswordPage';
import { ComingSoonPage } from './pages/ComingSoonPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { TeacherAdviseesPage } from './pages/TeacherAdviseesPage';
import { StudentProfilePage } from './pages/StudentProfilePage';
import { StudentProfileViewPage } from './pages/StudentProfileViewPage';
import { StudentRequestPage } from './pages/StudentRequestPage';
import { TeacherProfilePage } from './pages/TeacherProfilePage';
import { TeacherRequestsPage } from './pages/TeacherRequestsPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { StudentRegistrationPage } from './pages/StudentRegistrationPage';
import { TeacherRegistrationPage } from './pages/TeacherRegistrationPage';
import { NotFoundPage } from './pages/NotFoundPage';

// Telas já implementadas; os itens do menu sem tela mostram a página "em breve".
const screens: Record<string, ReactElement> = {
  '/aluno/orientadores': <AdvisorsPage />,
  '/aluno/perfil': <StudentProfilePage />,
  '/aluno/solicitacao': <StudentRequestPage />,
  '/professor/orientandos': <TeacherAdviseesPage />,
  '/professor/perfil': <TeacherProfilePage />,
  '/professor/solicitacoes': <TeacherRequestsPage />,
};

// Telas de uma área que não são itens do menu: abrem a partir de outra tela.
const subScreens: Record<string, ReactElement> = {
  [paths.studentPassword]: (
    <ChangePasswordPage profilePath={paths.studentProfile} />
  ),
  [paths.teacherPassword]: (
    <ChangePasswordPage profilePath={paths.teacherProfile} />
  ),
  [paths.teacherStudent]: <StudentProfileViewPage />,
};

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path={paths.login} element={<LoginPage />} />
        <Route path={paths.forgotPassword} element={<ForgotPasswordPage />} />
        <Route path={paths.resetPassword} element={<ResetPasswordPage />} />
        <Route
          path={paths.registerStudent}
          element={<StudentRegistrationPage />}
        />
        <Route
          path={paths.registerTeacher}
          element={<TeacherRegistrationPage />}
        />
        {areas.map(({ userType, path, title, items }) => (
          <Route key={userType} element={<RequireAuth userType={userType} />}>
            {items.length === 0 ? (
              <Route path={path} element={<AreaPage title={title} />} />
            ) : (
              <>
                <Route
                  path={path}
                  element={<Navigate to={items[0]!.path} replace />}
                />
                {items.map((item) => (
                  <Route
                    key={item.path}
                    path={item.path}
                    element={
                      screens[item.path] ?? (
                        <ComingSoonPage title={item.label} />
                      )
                    }
                  />
                ))}
                {Object.entries(subScreens)
                  .filter(([subPath]) => subPath.startsWith(`${path}/`))
                  .map(([subPath, element]) => (
                    <Route key={subPath} path={subPath} element={element} />
                  ))}
              </>
            )}
          </Route>
        ))}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
