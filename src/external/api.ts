import axios from 'axios';
import {
    baseAPI,
    baseExpertiseAreasAPI,
    baseInstitutesAPI,
    baseProfessorsAPI,
    baseSupervisionRequestAPI,
    baseUserAPI,
} from './constants';

import { Professor } from '@/utils/interfaces';

const api = axios.create({ baseURL: baseAPI });

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

    async login(username: string, password: string) {
        const response = await api.post(`${baseUserAPI}/pair`, { username, password });
        const { access_token, refresh_token } = response.data;

        localStorage.setItem('access_token', access_token);
        localStorage.setItem('refresh_token', refresh_token);

        return response.data;
    },

    async refreshToken() {
        const refresh_token = localStorage.getItem('refresh_token');
        const response = await api.post(`${baseUserAPI}/refresh`, { refresh_token });
        const { access_token } = response.data;

        localStorage.setItem('access_token', access_token);
        return access_token;
    },

    async requestSupervision(message: string, professorUUID: string) {
        const access_token = localStorage.getItem('access_token');
        const response = await api.post(
            `${baseSupervisionRequestAPI}/student`,
            { message, professorUUID },
            { headers: { 'Authorization': `Bearer ${access_token}` } }
        );
        return response.data;
    },

    logout() {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
    }
};