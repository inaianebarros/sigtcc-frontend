import type { ReactElement } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { RequireAuth } from './components/RequireAuth';
import { areas } from './navigation/areas';
import { paths } from './navigation/paths';
import { AreaPage } from './pages/AreaPage';
import { ComingSoonPage } from './pages/ComingSoonPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { StudentProfilePage } from './pages/StudentProfilePage';
import { TeacherProfilePage } from './pages/TeacherProfilePage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { StudentRegistrationPage } from './pages/StudentRegistrationPage';
import { TeacherRegistrationPage } from './pages/TeacherRegistrationPage';
import { NotFoundPage } from './pages/NotFoundPage';

// Telas já implementadas; os itens do menu sem tela mostram a página "em breve".
const screens: Record<string, ReactElement> = {
  '/aluno/perfil': <StudentProfilePage />,
  '/professor/perfil': <TeacherProfilePage />,
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
              </>
            )}
          </Route>
        ))}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
