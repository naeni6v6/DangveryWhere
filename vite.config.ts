import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    // 네이버 지도 Client ID 에 등록된 주소가 http://localhost:5173 이라,
    // 포트가 5174 등으로 밀리면 지도 인증(401)이 실패합니다. 항상 5173 만 사용해요.
    port: 5173,
    strictPort: true
  }
});
