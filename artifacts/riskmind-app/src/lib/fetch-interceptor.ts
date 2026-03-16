/**
 * Intercepts global fetch to automatically inject the Bearer token
 * for all requests going to /api/v1
 */
const originalFetch = window.fetch;

window.fetch = async (...args) => {
  let [resource, config] = args;
  
  const url = typeof resource === 'string' 
    ? resource 
    : resource instanceof Request ? resource.url : resource.toString();

  const isSameOrigin = url.startsWith('/') || url.startsWith(window.location.origin);
  if (isSameOrigin && url.includes('/api/')) {
    const token = localStorage.getItem('accessToken');
    
    if (token) {
      config = config || {};
      const headers = new Headers(config.headers || {});
      
      if (!headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      
      config.headers = headers;
      
      if (resource instanceof Request) {
        resource = new Request(resource, config);
        config = undefined;
      }
    }
  }

  const response = await originalFetch(resource, config);
  
  // Handle unauthorized silently (app layout will handle redirect)
  if (response.status === 401 && !url.includes('/auth/login')) {
    localStorage.removeItem('accessToken');
    // We don't force redirect here to allow components to handle their own errors if needed
    // But we clear the token so useGetMe will fail and layout will redirect.
  }
  
  return response;
};

export {};
