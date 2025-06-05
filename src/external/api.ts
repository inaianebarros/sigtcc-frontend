import axios from 'axios';
import { baseAPI, baseUserAPI } from './constants';

const api = axios.create({ baseURL: baseAPI });

export const backendService = {
    async login(username: string, password: string) {
        const response = await api.post(`${baseUserAPI}/pair`, { username, password });
        const { access_token, refresh_token } = response.data;

        localStorage.setItem('access_token', access_token);
        localStorage.setItem('refresh_token', refresh_token);

        return response.data;
    },
};