import axios, { AxiosError, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import {
    baseAPI,
    baseExpertiseAreasAPI,
    baseInstitutesAPI,
    baseProfessorsAPI,
    baseStudentsAPI,
    baseSupervisionRequestAPI,
    baseUserAPI,
} from './constants';

import { Professor, Student } from '@/utils/interfaces';

const api = axios.create({ baseURL: baseAPI });

/**
 * Sistema de renovação automática de tokens
 *
 * Este sistema implementa um mecanismo de interceptação de requisições Axios que:
 * 1. Adiciona automaticamente o token de acesso a todas as requisições
 * 2. Intercepta erros 401 (Unauthorized) e tenta renovar o token
 * 3. Coloca requisições que falharam em uma fila para reenvio após renovação
 * 4. Redireciona para a página de login se a renovação falhar
 */

// Armazena requisições que falharam por token expirado
let isRefreshing = false;
let failedQueue: {
    resolve: (value: unknown) => void;
    reject: (reason?: any) => void;
    config: AxiosRequestConfig;
}[] = [];

// Processa a fila de requisições após renovação do token
const processQueue = (error: any = null, token: string | null = null) => {
    failedQueue.forEach(request => {
        if (error) {
            request.reject(error);
        } else if (token) {
            // Atualiza o token na requisição original
            if (request.config.headers) {
                request.config.headers['Authorization'] = `Bearer ${token}`;
            }
            request.resolve(api(request.config));
        }
    });

    failedQueue = [];
};

// Interceptor de requisição para adicionar token de acesso
api.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        const token = localStorage.getItem('access_token');
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Interceptor de resposta para lidar com token expirado
api.interceptors.response.use(
    (response: AxiosResponse) => response,
    async (error: AxiosError) => {
        const originalRequest = error.config as AxiosRequestConfig;

        // Verifica se é erro de autenticação (401) e se não é uma requisição de refresh
        if (error.response?.status === 401 &&
            originalRequest &&
            originalRequest.url !== `${baseUserAPI}/refresh`) {

            // Se já estiver renovando o token, adiciona à fila
            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject, config: originalRequest });
                });
            }

            isRefreshing = true;

            try {
                // Tenta renovar o token
                const newToken = await backendService.refreshToken();

                // Atualiza o token na requisição original
                if (originalRequest.headers) {
                    originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
                }

                // Processa a fila de requisições pendentes
                processQueue(null, newToken);

                // Reenviar a requisição original com o novo token
                return api(originalRequest);
            } catch (refreshError) {
                // Se falhar ao renovar o token, rejeita todas as requisições na fila
                processQueue(refreshError, null);

                // Redireciona para login ou limpa os tokens
                backendService.logout();

                // Se estiver em ambiente de navegador, redireciona para login
                if (typeof window !== 'undefined') {
                    window.location.href = '/';
                }

                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }

        return Promise.reject(error);
    }
);

export const backendService = {
    async getExpertiseAreas() {
        const response = await api.get(baseExpertiseAreasAPI);
        return response.data;
    },

    async getInstitutes() {
        const response = await api.get(baseInstitutesAPI);
        return response.data;
    },

    async getFilteredProfessors(
        expertiseAreasUUIDs: string[],
        institutesUUID: string,
        professorName: string
    ) {
        const response = await api.get(
            baseProfessorsAPI, {
            params: {
                expertise_areas_uuids: expertiseAreasUUIDs,
                institute_uuids: institutesUUID,
                first_name: professorName
            }
        }
        );
        return response.data;
    },

    async getProfessor(professorUUID: string): Promise<Professor> {
        const response = await api.get(`${baseProfessorsAPI}/${professorUUID}`);
        return response.data;
    },

    async getStudent(studentUUID: string): Promise<Student> {
        const response = await api.get(`${baseStudentsAPI}/${studentUUID}`);
        return response.data;
    },

    async login(username: string, password: string): Promise<string> {
        const response = await api.post(`${baseUserAPI}/pair`, { username, password });
        const { access, refresh, role } = response.data;

        localStorage.setItem('access_token', access);
        localStorage.setItem('refresh_token', refresh);

        return role;
    },

    async refreshToken() {
        const refresh_token = localStorage.getItem('refresh_token');
        const response = await api.post(`${baseUserAPI}/refresh`, { refresh_token });
        const { access } = response.data;

        localStorage.setItem('access_token', access);
        return access;
    },

    async answerSupervision(answer: string, message: string, supervisionRequestUUID: string) {
        const response = await api.post(
            `${baseSupervisionRequestAPI}/professor`,
            { answer: answer, professor_message: message, uuid: supervisionRequestUUID }
        );
        return response.data;
    },

    async requestSupervision(message: string, professorUUID: string) {
        const response = await api.post(
            `${baseSupervisionRequestAPI}/student`,
            { student_message: message, professor_uuid: professorUUID }
        );
        return response.data;
    },

    async listRequestedSupervisions() {
        const response = await api.get(`${baseSupervisionRequestAPI}/professor`)
        return response.data;
    },

    logout() {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
    }
};