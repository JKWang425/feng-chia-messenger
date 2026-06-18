<template>
  <div class="container">
    <header class="app-header glass-panel animate-fade-in">
      <div class="header-top">
        <div class="logo">
          <h1>🎓 校園生活</h1>
          <p>資訊恆久遠，一站永流傳</p>
        </div>
        <div class="user-actions">
          <button v-if="currentUser?.role === 'admin'" @click="showAdmin = !showAdmin" class="btn-secondary">
            <Shield class="icon-sm" /> {{ showAdmin ? '返回前台' : '管理員後台' }}
          </button>
          
          <template v-if="currentUser">
            <span class="welcome-text">Hi, {{ currentUser.username }}</span>
            <button @click="logout" class="btn-danger">登出</button>
          </template>
          <button v-else @click="showAuthModal = true" class="btn-primary">
            登入 / 註冊
          </button>
        </div>
      </div>
    </header>

    <main class="main-layout">
      <aside v-if="!showAdmin" class="sidebar glass-panel animate-fade-in">
        <div class="sidebar-section">
          <h3>看板分類</h3>
          <ul class="board-list">
            <li :class="{ active: currentBoardId === null }" @click="currentBoardId = null; fetchPosts()">
              🌟 全部貼文
            </li>
            <li v-for="board in boards" :key="board.id" 
                :class="{ active: currentBoardId === board.id }" 
                @click="currentBoardId = board.id; fetchPosts()">
              {{ board.name }}
            </li>
          </ul>
        </div>
      </aside>

      <div class="content-area" v-if="!showAdmin">
        <div class="actions animate-fade-in" style="animation-delay: 0.1s;">
          <div class="sort-options">
            <button :class="['btn-sort', { active: currentSort === 'latest' }]" @click="currentSort = 'latest'; fetchPosts()">最新</button>
            <button :class="['btn-sort', { active: currentSort === 'popular' }]" @click="currentSort = 'popular'; fetchPosts()">熱門</button>
          </div>
          <button @click="openCreatePost" class="btn-create">
            <PlusCircle class="icon-md" /> 發布新貼文
          </button>
        </div>

        <div class="post-feed">
          <PostItem 
            v-for="(post, index) in posts" 
            :key="post.id" 
            :post="post" 
            :currentUser="currentUser"
            :boards="boards"
            @reply-added="fetchPosts"
            class="animate-fade-in"
            :style="{ animationDelay: `${(index + 2) * 0.1}s` }"
          />
          <div v-if="posts.length === 0 && !loading" class="empty-state glass-panel">
            目前還沒有貼文喔，來當第一個發文的人吧！
          </div>
          <div v-if="loading" class="loading-state">載入中...</div>
        </div>
      </div>
      
      <AdminDashboard v-else @close="showAdmin = false" />
    </main>

    <CreatePost 
      v-if="showCreateModal" 
      :boards="boards"
      :currentBoardId="currentBoardId"
      @close="showCreateModal = false" 
      @post-created="handlePostCreated" 
    />

    <AuthModal
      v-if="showAuthModal"
      @close="showAuthModal = false"
      @auth-success="handleAuthSuccess"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import axios from 'axios';
import { Shield, PlusCircle } from 'lucide-vue-next';
import PostItem from './components/PostItem.vue';
import CreatePost from './components/CreatePost.vue';
import AuthModal from './components/AuthModal.vue';
import AdminDashboard from './components/AdminDashboard.vue';

const posts = ref([]);
const loading = ref(true);
const showCreateModal = ref(false);
const showAuthModal = ref(false);
const showAdmin = ref(false);
const currentUser = ref(null);
const boards = ref([]);
const currentBoardId = ref(null);
const currentSort = ref('latest');

let ws = null;

const fetchBoards = async () => {
  try {
    const res = await axios.get('/api/boards');
    boards.value = res.data;
  } catch (err) {
    console.error('Failed to fetch boards:', err);
  }
};

const checkAuth = async () => {
  try {
    const res = await axios.get('/api/auth/me', { withCredentials: true });
    currentUser.value = res.data.user;
  } catch (err) {
    currentUser.value = null;
  }
};

const logout = async () => {
  try {
    await axios.post('/api/auth/logout', {}, { withCredentials: true });
    currentUser.value = null;
    showAdmin.value = false;
  } catch (err) {
    console.error("Logout failed", err);
  }
};

const fetchPosts = async () => {
  try {
    loading.value = true;
    let url = `/api/posts?sort=${currentSort.value}`;
    if (currentBoardId.value) url += `&board_id=${currentBoardId.value}`;
    
    const response = await axios.get(url);
    posts.value = response.data;
  } catch (error) {
    console.error('Error fetching posts:', error);
  } finally {
    loading.value = false;
  }
};

const trackVisit = async () => {
  try {
    await axios.post('/api/visits');
  } catch (e) {
    console.error('Failed to track visit', e);
  }
};

const setupWebSocket = () => {
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsHost = import.meta.env.PROD ? window.location.host : 'localhost:3000';
  ws = new WebSocket(`${wsProtocol}//${wsHost}`);
  
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    
    if (message.type === 'NEW_POST') {
      posts.value.unshift(message.data);
    } else if (message.type === 'NEW_REPLY') {
      const post = posts.value.find(p => p.id === message.data.post_id);
      if (post) {
        if (!post.replies) post.replies = [];
        post.replies.push(message.data);
      }
    } else if (message.type === 'POST_DELETED') {
      // Refresh the feed when admin deletes something
      fetchPosts();
    }
  };

  ws.onclose = () => {
    setTimeout(setupWebSocket, 3000);
  };
};

const openCreatePost = () => {
  if (!currentUser.value) {
    showAuthModal.value = true;
  } else {
    showCreateModal.value = true;
  }
};

const handlePostCreated = () => {
  showCreateModal.value = false;
};

const handleAuthSuccess = (user) => {
  showAuthModal.value = false;
  currentUser.value = user;
};

onMounted(() => {
  trackVisit();
  checkAuth();
  fetchBoards();
  fetchPosts();
  setupWebSocket();
});

onUnmounted(() => {
  if (ws) ws.close();
});
</script>

<style scoped>
.app-header { padding: 24px; margin-bottom: 32px; }
.header-top { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 20px; }

.logo h1 { font-size: 2.5rem; margin-bottom: 8px; background: linear-gradient(to right, var(--primary-color), #ff7b00); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.logo p { color: var(--text-secondary); font-size: 1.1rem; }

.user-actions { display: flex; align-items: center; gap: 16px; }
.welcome-text { color: var(--text-primary); font-weight: 500; }

.btn-secondary { background: rgba(255,255,255,0.1); color: #fff; display: flex; align-items: center; gap: 8px; border: none; padding: 10px 16px; border-radius: 8px; cursor: pointer; transition: 0.2s; font-size: 1rem; }
.btn-secondary:hover { background: rgba(255,255,255,0.2); }

.btn-danger { background: rgba(255, 71, 87, 0.2); color: var(--danger); border: none; padding: 10px 16px; border-radius: 8px; cursor: pointer; transition: 0.2s; font-weight: bold; }
.btn-danger:hover { background: var(--danger); color: #fff; }

.btn-primary { background: var(--primary-color); color: #fff; border: none; padding: 10px 16px; border-radius: 8px; cursor: pointer; transition: 0.2s; font-weight: bold; }
.btn-primary:hover { background: var(--primary-hover); }

.actions { display: flex; justify-content: space-between; margin-bottom: 24px; align-items: center; }
.btn-create { display: flex; align-items: center; gap: 8px; font-size: 1.1rem; padding: 12px 24px; border-radius: 30px; box-shadow: 0 4px 15px rgba(247, 160, 64, 0.4); border: none; color: #fff; background: var(--primary-color); cursor: pointer; transition: 0.2s; }
.btn-create:hover { background: var(--primary-hover); transform: translateY(-2px); }

.main-layout { display: flex; gap: 24px; }
.sidebar { width: 250px; flex-shrink: 0; padding: 20px; align-self: flex-start; position: sticky; top: 20px; }
.sidebar h3 { font-size: 1.1rem; color: var(--text-secondary); margin-bottom: 12px; padding-left: 8px; }
.content-area { flex-grow: 1; min-width: 0; }
.board-list { list-style: none; padding: 0; margin: 0; }
.board-list li { padding: 12px 16px; margin-bottom: 8px; border-radius: 8px; cursor: pointer; transition: 0.2s; color: var(--text-secondary); font-weight: 500; }
.board-list li:hover { background: rgba(255,255,255,0.1); color: var(--text-primary); }
.board-list li.active { background: var(--primary-color); color: white; }

.sort-options { display: flex; gap: 8px; }
.btn-sort { padding: 8px 16px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.2); background: transparent; color: var(--text-secondary); cursor: pointer; transition: 0.2s; font-weight: 600; }
.btn-sort:hover { background: rgba(255,255,255,0.05); }
.btn-sort.active { background: rgba(255,255,255,0.1); color: var(--text-primary); border-color: var(--primary-color); }

.post-feed { display: flex; flex-direction: column; gap: 20px; }
.empty-state, .loading-state { text-align: center; padding: 40px; color: var(--text-secondary); font-size: 1.2rem; }

.icon-sm { width: 18px; height: 18px; }
.icon-md { width: 22px; height: 22px; }

@media (max-width: 600px) {
  .header-top { flex-direction: column; align-items: stretch; text-align: center; }
  .user-actions { justify-content: center; }
}
</style>
