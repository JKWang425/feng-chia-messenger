<template>
  <article class="post-card glass-panel">
    <div class="post-header">
      <div class="post-meta">
        <span class="board-badge">{{ boardName }}</span>
        <span class="author-badge"><User class="icon-sm" /> {{ post.author }}</span>
        <span class="post-date">{{ formatDate(post.created_at) }}</span>
      </div>
      <div class="post-actions">
        <button v-if="canDelete" @click="deletePost" class="btn-icon btn-delete" title="刪除貼文">
          <Trash2 class="icon-sm" />
        </button>
        <button @click="printPost" class="btn-icon" title="列印 / 匯出 PDF">
          <Printer class="icon-sm" />
        </button>
      </div>
    </div>
    
    <h2 class="post-title">{{ post.title }}</h2>

    <div class="post-content">
      {{ post.content }}
    </div>

    <div v-if="post.image_url" class="post-image-container">
      <img :src="post.image_url" alt="Post Image" class="post-image" />
    </div>

    <div class="post-footer">
      <div class="interaction-buttons">
        <button class="btn-action" :class="{ active: post.isLiked }" @click="toggleLike" title="按讚">
          <Heart class="icon-sm" :fill="post.isLiked ? 'currentColor' : 'none'" /> {{ post.likesCount || 0 }}
        </button>
        <button class="btn-action" :class="{ active: post.isSaved }" @click="toggleSave" title="收藏">
          <Bookmark class="icon-sm" :fill="post.isSaved ? 'currentColor' : 'none'" /> {{ post.savesCount || 0 }}
        </button>
      </div>

      <button class="btn-toggle-replies" @click="toggleReplies">
        <MessageSquare class="icon-sm" /> {{ post.replies ? post.replies.length : 0 }} 則留言
        <ChevronDown class="toggle-icon" :class="{ 'is-open': showReplies }" />
      </button>
    </div>

    <!-- Replies Section -->
    <div v-if="showReplies" class="replies-section animate-fade-in">
      <div class="replies-list" v-if="post.replies && post.replies.length > 0">
        <div v-for="reply in post.replies" :key="reply.id" class="reply-item">
          <div class="reply-header">
            <span class="reply-author">{{ reply.author }}</span>
            <span class="reply-date">{{ formatDate(reply.created_at) }}</span>
          </div>
          <div class="reply-content">{{ reply.content }}</div>
        </div>
      </div>
      <div v-else class="no-replies">
        還沒有人留言，快來搶頭香！
      </div>

      <!-- Reply Form -->
      <form @submit.prevent="submitReply" class="reply-form" v-if="currentUser">
        <div class="reply-inputs">
          <input 
            type="text" 
            v-model="replyContent" 
            placeholder="留個言吧..." 
            class="input-content"
            required
          >
          <button type="submit" class="btn-reply" :disabled="isSubmitting">
            <Send class="icon-sm" />
          </button>
        </div>
      </form>
      <div v-else class="login-prompt">
        請登入後再留言
      </div>
    </div>
  </article>
</template>

<script setup>
import { ref, computed } from 'vue';
import axios from 'axios';
import { User, MessageSquare, ChevronDown, Send, Trash2, Heart, Bookmark, Printer } from 'lucide-vue-next';

const props = defineProps({
  post: { type: Object, required: true },
  currentUser: { type: Object, default: null },
  boards: { type: Array, default: () => [] }
});

const emit = defineEmits(['reply-added']);

const showReplies = ref(false);
const isSubmitting = ref(false);
const replyContent = ref('');

const boardName = computed(() => {
  const board = props.boards.find(b => b.id === props.post.board_id);
  return board ? board.name : '未分類';
});

const canDelete = computed(() => {
  if (!props.currentUser) return false;
  if (props.currentUser.role === 'admin') return true;
  if (props.currentUser.username === props.post.author) return true;
  if (props.currentUser.moderated_boards?.includes(props.post.board_id)) return true;
  return false;
});

const toggleReplies = () => { showReplies.value = !showReplies.value; };

const formatDate = (dateString) => {
  if (!dateString) return '';
  // Convert SQLite UTC "YYYY-MM-DD HH:MM:SS" to ISO "YYYY-MM-DDTHH:MM:SSZ"
  const utcDateString = dateString.includes('T') ? dateString : dateString.replace(' ', 'T') + 'Z';
  const date = new Date(utcDateString);
  return date.toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
};

const deletePost = async () => {
  if (!confirm('確定要刪除這篇貼文嗎？')) return;
  try {
    await axios.delete(`/api/posts/${props.post.id}`, { withCredentials: true });
  } catch (err) {
    if (err.response?.status === 403) {
      alert('您沒有權限刪除這篇貼文');
    } else if (err.response?.status === 429) {
      alert(err.response.data?.error || '操作太頻繁了，請稍後再試！');
    } else {
      console.error('Failed to delete post:', err);
      alert('刪除失敗');
    }
  }
};

const toggleLike = async () => {
  if (!props.currentUser) return alert('請先登入才能按讚喔！');
  try {
    const res = await axios.post(`/api/posts/${props.post.id}/like`, {}, { withCredentials: true });
    props.post.isLiked = res.data.isLiked;
    props.post.likesCount = res.data.likesCount;
  } catch (e) {
    if (e.response?.status === 429) {
      alert(e.response.data?.error || '你按太快了，請稍後再試！');
    } else {
      console.error('Like failed', e);
    }
  }
};

const toggleSave = async () => {
  if (!props.currentUser) return alert('請先登入才能收藏喔！');
  try {
    const res = await axios.post(`/api/posts/${props.post.id}/save`, {}, { withCredentials: true });
    props.post.isSaved = res.data.isSaved;
    props.post.savesCount = res.data.savesCount;
  } catch (e) {
    if (e.response?.status === 429) {
      alert(e.response.data?.error || '你按太快了，請稍後再試！');
    } else {
      console.error('Save failed', e);
    }
  }
};

const submitReply = async () => {
  if (!replyContent.value) return;
  
  isSubmitting.value = true;
  try {
    const response = await axios.post(`/api/posts/${props.post.id}/replies`, {
      content: replyContent.value
    }, { withCredentials: true });

    if (response.status === 201) {
      replyContent.value = '';
      emit('reply-added');
    }
  } catch (error) {
    if (error.response?.status === 429) {
      alert(error.response.data?.error || '留言太頻繁了，請稍後再試！');
    } else {
      console.error('Error submitting reply:', error);
    }
  } finally {
    isSubmitting.value = false;
  }
};

const printPost = () => {
  const printWindow = window.open('', '_blank');
  const boardLabel = boardName.value;
  printWindow.document.write(`
    <html><head><title>${props.post.title}</title>
    <style>body{font-family:sans-serif;padding:40px;max-width:700px;margin:auto}
    h1{font-size:1.5rem}p{line-height:1.8;white-space:pre-wrap}
    .meta{color:#888;margin-bottom:20px;font-size:0.9rem}
    .reply{border-left:3px solid #ddd;padding-left:12px;margin:12px 0}
    .reply-author{font-weight:bold;color:#555}
    </style></head><body>
    <h1>${props.post.title}</h1>
    <div class="meta">[${boardLabel}] by ${props.post.author}</div>
    <p>${props.post.content}</p>
    ${props.post.image_url ? `<img src="${props.post.image_url}" style="max-width:100%">` : ''}
    <hr>
    <h3>留言 (${props.post.replies?.length || 0})</h3>
    ${(props.post.replies || []).map(r => `<div class="reply"><span class="reply-author">${r.author}</span><p>${r.content}</p></div>`).join('')}
    </body></html>
  `);
  printWindow.document.close();
  printWindow.print();
};
</script>

<style scoped>
.post-card { padding: 24px; transition: transform 0.2s ease, box-shadow 0.2s ease; position: relative; }
.post-card:hover { transform: translateY(-2px); box-shadow: 0 12px 40px 0 rgba(0, 0, 0, 0.4); }

.post-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
.post-meta { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.board-badge {
  background: var(--primary-color); color: #fff; padding: 4px 10px; border-radius: 6px; font-size: 0.85rem; font-weight: 600;
}
.author-badge { 
  display: flex; align-items: center; gap: 4px;
  background: rgba(247, 160, 64, 0.2); color: var(--primary-color); 
  padding: 4px 10px; border-radius: 20px; font-size: 0.85rem; font-weight: 600; 
}
.post-date { color: var(--text-secondary); font-size: 0.85rem; }

.btn-icon { background: transparent; color: var(--text-secondary); padding: 4px; border-radius: 4px; border: none; cursor: pointer; transition: 0.2s;}
.btn-icon:hover { color: var(--primary-color); background: rgba(255,255,255,0.1); }
.btn-delete:hover { color: var(--danger); }

.post-title { font-size: 1.4rem; margin-bottom: 16px; line-height: 1.3; }
.post-content { color: var(--text-primary); font-size: 1rem; line-height: 1.6; white-space: pre-wrap; margin-bottom: 20px; }

.post-image-container { margin-bottom: 20px; border-radius: 8px; overflow: hidden; }
.post-image { max-width: 100%; max-height: 400px; object-fit: contain; }

.post-footer { border-top: 1px solid var(--card-border); padding-top: 16px; display: flex; justify-content: space-between; align-items: center; }

.interaction-buttons { display: flex; gap: 16px; }
.btn-action { display: flex; align-items: center; gap: 6px; background: transparent; border: none; color: var(--text-secondary); cursor: pointer; transition: 0.2s; font-size: 0.95rem; }
.btn-action:hover { color: #fff; transform: scale(1.05); }
.btn-action.active { color: #ff4757; }
.btn-action.active:last-child { color: #f1c40f; } /* Yellow for bookmark active */

.btn-toggle-replies { display: flex; align-items: center; gap: 8px; background: transparent; color: var(--text-secondary); border: none; cursor: pointer; transition: 0.2s; }
.btn-toggle-replies:hover { color: var(--primary-color); }
.toggle-icon { transition: transform 0.3s ease; }
.toggle-icon.is-open { transform: rotate(180deg); }

.replies-section { margin-top: 20px; padding: 20px; background: rgba(0, 0, 0, 0.15); border-radius: 12px; }
.replies-list { display: flex; flex-direction: column; gap: 16px; margin-bottom: 20px; }
.reply-item { padding-bottom: 16px; border-bottom: 1px dashed var(--card-border); }
.reply-item:last-child { border-bottom: none; padding-bottom: 0; }
.reply-header { display: flex; gap: 10px; margin-bottom: 6px; }
.reply-author { font-weight: 600; color: var(--primary-color); font-size: 0.9rem; }
.reply-content { font-size: 0.95rem; color: #ddd; }

.no-replies, .login-prompt { text-align: center; color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 10px; }
.reply-inputs { display: flex; gap: 10px; }
.input-content { flex: 1; padding: 10px; }
.btn-reply { padding: 10px 16px; display: flex; align-items: center; justify-content: center; }
.icon-sm { width: 16px; height: 16px; }
</style>
