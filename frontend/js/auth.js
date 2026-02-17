const API_URL = 'http://127.0.0.1:8000/api';

const auth = {
    async login(email, password) {
        try {
            const response = await fetch(`${API_URL}/auth/login/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Login failed');
            }

            const data = await response.json();
            localStorage.setItem('crisha_token', data.token);
            localStorage.setItem('crisha_user', JSON.stringify({ username: data.username, email: data.email }));
            window.location.href = 'dashboard.html';
            return data;
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    },

    async register(email, password) {
        try {
            // For MVP strictness, we use email as username
            const response = await fetch(`${API_URL}/auth/register/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password, username: email }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Registration failed');
            }

            const data = await response.json();
            localStorage.setItem('crisha_token', data.token);
            localStorage.setItem('crisha_user', JSON.stringify({ username: data.username, email: data.email }));
            window.location.href = 'dashboard.html';
            return data;
        } catch (error) {
            console.error('Registration error:', error);
            throw error;
        }
    },

    logout() {
        localStorage.removeItem('crisha_token');
        window.location.href = 'index.html';
    },

    getToken() {
        return localStorage.getItem('crisha_token');
    },

    checkAuth() {
        if (!this.getToken()) {
            window.location.href = 'login.html';
        }
    },

    // Helper for authenticated requests
    async fetchWithAuth(endpoint, options = {}) {
        const token = this.getToken();
        if (!token) throw new Error('No token found');

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
            console.error('Token:', token);
            console.error('Endpoint:', endpoint);
            console.error('Response:', await response.clone().text());
            alert('ОШИБКА 401! Проверьте консоль. НЕ делаю logout для отладки.');
            // ВРЕМЕННО ОТКЛЮЧЕН для отладки:
            // this.logout();
            throw new Error('Unauthorized');
        }

        return response;
    }
};
