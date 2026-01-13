// 简单的路由跳转，可根据需要替换为真实页面或前端路由
(function initNavigation() {
  const routes = {
    // 使用 songPlayer 中的播放器页面
    player: 'songPlayer/player.html',
    recommend: 'recommend.html',
    learning: 'learning.html',
  };

  const go = (path) => {
    window.location.href = path;
  };

  document.getElementById('btn-player')
    .addEventListener('click', () => go(routes.player));

  document.getElementById('btn-recommend')
    .addEventListener('click', () => go(routes.recommend));

  document.getElementById('btn-learning')
    .addEventListener('click', () => go(routes.learning));
})();
