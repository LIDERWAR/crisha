// Настройка URL API: в локальной разработке всегда целимся в порт 8000
const API_URL = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
    ? 'http://127.0.0.1:8000/api'
    : 'https://contractcheck.ru/api';

const auth = {
    // Вспомогательная функция для безопасного парсинга JSON
    async safeJson(response) {
        const text = await response.text();
        try {
            return JSON.parse(text);
        } catch (e) {
            console.error('Ответ не является JSON:', text);
            if (text.includes('<!DOCTYPE html>')) {
                throw new Error('Ошибка сервера (получен HTML). Проверьте консоль браузера.');
            }
            throw new Error('Ошибка парсинга ответа сервера');
        }
    },

    async login(email, password) {
        try {
            const response = await fetch(`${API_URL}/auth/login/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password, username: email }),
            });

            const data = await this.safeJson(response);

            if (!response.ok) {
                throw new Error(data.error || 'Ошибка входа');
            }

            localStorage.setItem('cc_token', data.token);
            localStorage.setItem('cc_user', JSON.stringify({ username: data.username, email: data.email }));
            window.location.href = 'dashboard.html';
            return data;
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    },

    async register(email, password) {
        try {
            const response = await fetch(`${API_URL}/auth/register/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password, username: email }),
            });

            const data = await this.safeJson(response);

            if (!response.ok) {
                throw new Error(data.error || 'Ошибка регистрации');
            }

            localStorage.setItem('cc_token', data.token);
            localStorage.setItem('cc_user', JSON.stringify({ username: data.username, email: data.email }));
            window.location.href = 'dashboard.html';
            return data;
        } catch (error) {
            console.error('Registration error:', error);
            throw error;
        }
    },

    async logout() {
        try {
            const token = this.getToken();
            if (token) {
                await fetch(`${API_URL}/auth/logout/`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Token ${token}`
                    }
                }).catch(err => console.warn('Logout API call failed:', err));
            }
        } finally {
            localStorage.removeItem('cc_token');
            localStorage.removeItem('cc_user');
            window.location.href = 'index.html';
        }
    },

    getToken() {
        return localStorage.getItem('cc_token');
    },

    checkAuth() {
        if (!this.getToken()) {
            window.location.href = 'login.html';
        }
    },

    async fetchWithAuth(endpoint, options = {}) {
        const token = this.getToken();
        if (!token) throw new Error('Токен не найден');

        const headers = {
            'Authorization': `Token ${token}`,
            ...options.headers
        };

        const response = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers
        });

        if (response.status === 401) {
            console.error('!!! 401 UNAUTHORIZED !!!');
            // В продакшене тут лучше делать logout, но для отладки пока оставим
            throw new Error('Сессия истекла. Войдите заново.');
        }

        return response;
    }
};
