<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content glass-panel animate-fade-in">
      <div class="modal-header">
        <h2>{{ isLogin ? '登入' : '註冊' }}</h2>
        <button class="btn-close" @click="$emit('close')">&times;</button>
      </div>

      <form @submit.prevent="submitAuth" class="auth-form">
        <div class="form-group">
          <label for="username">帳號 (學號 / 暱稱)</label>
          <input 
            type="text" 
            id="username" 
            v-model="form.username" 
            placeholder="請輸入帳號" 
            required
          >
        </div>

        <div class="form-group">
          <label for="password">密碼</label>
          <input 
            type="password" 
            id="password" 
            v-model="form.password" 
            placeholder="請輸入密碼" 
            required
          >
        </div>

        <div v-if="errorMsg" class="error-msg">{{ errorMsg }}</div>

        <div class="form-actions">
          <span class="toggle-mode" @click="isLogin = !isLogin">
            {{ isLogin ? '沒有帳號？點此註冊' : '已有帳號？點此登入' }}
          </span>
          <button type="submit" class="btn-submit" :disabled="isLoading">
            {{ isLoading ? '處理中...' : (isLogin ? '登入' : '註冊') }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue';
import axios from 'axios';

const emit = defineEmits(['close', 'auth-success']);

const isLogin = ref(true);
const isLoading = ref(false);
const errorMsg = ref('');

const form = reactive({
  username: '',
  password: ''
});

const submitAuth = async () => {
  isLoading.value = true;
  errorMsg.value = '';
  
  const endpoint = isLogin.value ? '/api/auth/login' : '/api/auth/register';
  
  try {
    const response = await axios.post(endpoint, form, {
      withCredentials: true // send cookies
    });
    
    if (response.data) {
      emit('auth-success', response.data.user);
    }
  } catch (err) {
    errorMsg.value = err.response?.data?.error || '發生錯誤，請稍後再試';
  } finally {
    isLoading.value = false;
  }
};
</script>

<style scoped>
/* Modal base styles (similar to CreatePost) */
.modal-overlay {
  position: fixed;
  top: 0; left: 0; width: 100vw; height: 100vh;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(5px);
  display: flex; justify-content: center; align-items: center;
  z-index: 1000;
}

.modal-content {
  width: 90%; max-width: 400px; padding: 30px;
  background: rgba(25, 30, 50, 0.85);
}

.modal-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 24px;
}

.modal-header h2 { color: var(--primary-color); }
.btn-close { background: transparent; color: var(--text-secondary); font-size: 1.8rem; padding: 0; }
.btn-close:hover { color: var(--danger); transform: scale(1.1); }

.form-group { margin-bottom: 20px; }
.form-group label { display: block; margin-bottom: 8px; color: var(--text-primary); }
.error-msg { color: var(--danger); font-size: 0.9rem; margin-bottom: 10px; }

.form-actions {
  display: flex; justify-content: space-between; align-items: center; margin-top: 30px;
}

.toggle-mode {
  color: var(--primary-color); cursor: pointer; font-size: 0.9rem;
}
.toggle-mode:hover { text-decoration: underline; }
</style>
