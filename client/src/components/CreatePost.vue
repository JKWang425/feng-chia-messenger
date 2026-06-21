<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content glass-panel animate-fade-in">
      <div class="modal-header">
        <h2>發布新貼文</h2>
        <button class="btn-close" @click="$emit('close')">&times;</button>
      </div>

      <form @submit.prevent="submitPost" class="post-form">
        <div class="form-group">
          <label for="board">選擇看板</label>
          <select id="board" v-model="form.board_id" required>
            <option v-for="board in boards" :key="board.id" :value="board.id">
              {{ board.name }}
            </option>
          </select>
        </div>

        <div class="form-group">
          <label for="title">標題</label>
          <input type="text" id="title" v-model="form.title" placeholder="請輸入標題" required maxlength="100">
        </div>

        <div class="form-group">
          <label for="content">內容</label>
          <textarea id="content" v-model="form.content" placeholder="想說些什麼呢？" rows="5" required></textarea>
        </div>

        <div class="form-group">
          <label for="image">上傳圖片 (選填)</label>
          <input type="file" id="image" @change="handleFileChange" accept="image/*">
        </div>

        <div class="form-actions">
          <button type="button" class="btn-cancel" @click="$emit('close')">取消</button>
          <button type="submit" class="btn-submit" :disabled="isSubmitting">
            {{ isSubmitting ? '發布中...' : '確認發布' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue';
import axios from 'axios';

const props = defineProps(['boards', 'currentBoardId']);
const emit = defineEmits(['close', 'post-created']);

const form = reactive({ 
  title: '', 
  content: '', 
  board_id: props.currentBoardId || (props.boards.length > 0 ? props.boards[0].id : 1) 
});
const selectedFile = ref(null);
const isSubmitting = ref(false);

const handleFileChange = (e) => {
  selectedFile.value = e.target.files[0];
};

const submitPost = async () => {
  if (!form.title || !form.content) return;
  
  isSubmitting.value = true;
  try {
    const formData = new FormData();
    formData.append('title', form.title);
    formData.append('content', form.content);
    formData.append('board_id', form.board_id);
    if (selectedFile.value) {
      formData.append('image', selectedFile.value);
    }

    const response = await axios.post('/api/posts', formData, {
      withCredentials: true,
      headers: { 'Content-Type': 'multipart/form-data' }
    });

    if (response.status === 201) {
      emit('post-created');
    }
  } catch (error) {
    if (error.response?.status === 429) {
      alert(error.response.data?.error || '你發文太頻繁了，請稍候再試！');
    } else if(error.response?.status === 401) {
      alert("請先登入才能發文！");
    } else {
      console.error('Error submitting post:', error);
      alert('發文失敗，請稍後再試');
    }
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<style scoped>
/* Modal base styles from App.vue... */
.modal-overlay {
  position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
  background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(5px);
  display: flex; justify-content: center; align-items: center; z-index: 1000;
}
.modal-content {
  width: 90%; max-width: 600px; padding: 30px; background: rgba(25, 30, 50, 0.85);
}
.modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
.modal-header h2 { font-size: 1.5rem; color: var(--primary-color); }
.btn-close { background: transparent; color: var(--text-secondary); font-size: 1.8rem; padding: 0; }
.btn-close:hover { color: var(--danger); transform: scale(1.1); }
.form-group { margin-bottom: 20px; }
.form-group label { display: block; margin-bottom: 8px; font-weight: 500; }
select { width: 100%; padding: 12px; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; background: rgba(0,0,0,0.2); color: #fff; font-size: 1rem; }
select option { background: #1a1e36; color: #fff; }
input[type="file"] { padding: 8px; }
.form-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 30px; }
.btn-cancel { background: transparent; border: 1px solid var(--text-secondary); color: var(--text-primary); }
.btn-cancel:hover { background: rgba(255, 255, 255, 0.1); }
</style>
