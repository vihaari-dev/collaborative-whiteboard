import axios from 'axios';

const baseURL = import.meta.env.PROD ? '/api' : 'http://localhost:5000/api';

const API = axios.create({
    baseURL,
});

// Add token to requests if it exists
API.interceptors.request.use((req) => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (user && user.token) {
        req.headers.Authorization = `Bearer ${user.token}`;
    }
    return req;
});

export const login = (formData) => API.post('/auth/login', formData);
export const register = (formData) => API.post('/auth/register', formData);

// Board APIs
export const getBoards = () => API.get('/boards');
export const createBoard = (data) => API.post('/boards', data);
export const getBoard = (id) => API.get(`/boards/${id}`);
export const updateBoard = (id, data) => API.put(`/boards/${id}`, data);
export const uploadDocument = (id, formData) => API.post(`/boards/${id}/upload`, formData, {
    headers: {
        'Content-Type': 'multipart/form-data',
    },
});

export const uploadVoiceNote = (id, formData) => API.post(`/boards/${id}/voice`, formData, {
    headers: {
        'Content-Type': 'multipart/form-data',
    },
});

export const deleteVoiceNoteApi = (boardId, noteId) => API.delete(`/boards/${boardId}/voice/${noteId}`);

export const updateVoiceNotePositionApi = (boardId, noteId, x, y) => API.patch(`/boards/${boardId}/voice/${noteId}/position`, { x, y });

export default API;
