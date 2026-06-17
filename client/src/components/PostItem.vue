<template>
  <article class="post-card glass-panel">
    <div class="post-header">
      <div class="post-meta">
        <span class="author-badge"><User class="icon-sm" /> {{ post.author }}</span>
        <span class="post-date">{{ formatDate(post.created_at) }}</span>
      </div>
      <div class="post-actions">
        <button v-if="currentUser?.role === 'admin'" @click="deletePost" class="btn-icon btn-delete" title="刪除貼文">
          <Trash2 class="icon-sm" />
        </button>
        <button @click="downloadPdf" class="btn-icon" title="下載 PDF">
          <Download class="icon-sm" />
        </button>
      </div>
    </div>
    
    <h2 class="post-title">{{ post.title }}</h2>

    <div class="post-content">
      {{ post.content }}
    </div>

    <div v-if="post.image_url" class="post-image-container">
      <img :src="`http://localhost:3000${post.image_url}`" alt="Post Image" class="post-image" />
    </div>

    <div class="post-footer">
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
import { ref } from 'vue';
import axios from 'axios';
import { User, MessageSquare, ChevronDown, Download, Send, Trash2 } from 'lucide-vue-next';
import { PDFDocument, StandardFonts } from 'pdf-lib';

const props = defineProps({
  post: { type: Object, required: true },
  currentUser: { type: Object, default: null }
});

const emit = defineEmits(['reply-added']);

const showReplies = ref(false);
const isSubmitting = ref(false);
const replyContent = ref('');

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
    await axios.delete(`http://localhost:3000/api/admin/posts/${props.post.id}`, { withCredentials: true });
    // WebSocket will trigger refetch automatically
  } catch (err) {
    console.error('Failed to delete post:', err);
    alert('刪除失敗');
  }
};

const submitReply = async () => {
  if (!replyContent.value) return;
  
  isSubmitting.value = true;
  try {
    const response = await axios.post(`http://localhost:3000/api/posts/${props.post.id}/replies`, {
      content: replyContent.value
    }, { withCredentials: true });

    if (response.status === 201) {
      replyContent.value = '';
      // We don't necessarily emit 'reply-added' if WebSockets are handling updates,
      // but emitting is safe for backward compatibility.
      emit('reply-added');
    }
  } catch (error) {
    console.error('Error submitting reply:', error);
  } finally {
    isSubmitting.value = false;
  }
};

const downloadPdf = async () => {
  try {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    
    // Fallback for Chinese characters in pdf-lib standard fonts is tricky, 
    // but for demonstration we'll just write out the data.
    page.drawText(`Feng Chia Messenger - Post ID: ${props.post.id}`, { x: 50, y: 800, size: 20, font });
    page.drawText(`Author: ${props.post.author}`, { x: 50, y: 770, size: 14, font });
    // Use ascii or simple representation since standard fonts drop CJK
    page.drawText(`Content length: ${props.post.content.length} characters`, { x: 50, y: 740, size: 12, font });

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `FCU-Post-${props.post.id}.pdf`;
    link.click();
  } catch (e) {
    console.error("PDF Export Error", e);
  }
};
</script>

<style scoped>
.post-card { padding: 24px; transition: transform 0.2s ease, box-shadow 0.2s ease; position: relative; }
.post-card:hover { transform: translateY(-2px); box-shadow: 0 12px 40px 0 rgba(0, 0, 0, 0.4); }

.post-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
.post-meta { display: flex; align-items: center; gap: 12px; }
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

.post-footer { border-top: 1px solid var(--card-border); padding-top: 16px; }

.btn-toggle-replies { display: flex; align-items: center; gap: 8px; background: transparent; color: var(--text-secondary); }
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
