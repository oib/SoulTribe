/**
 * Loads HTML components into elements with data-component attribute
 * Example: <div data-component="navbar"></div>
 */
async function loadComponents() {
  const components = document.querySelectorAll('[data-component]');
  
  for (const component of components) {
    const componentName = component.getAttribute('data-component');
    try {
      const response = await fetch(`/components/${componentName}.html`);
      if (!response.ok) {
        console.error(`Failed to load component: ${componentName}`);
        continue;
      }
      
      const html = await response.text();
      component.outerHTML = html;
      
      // Dispatch an event when a component is loaded
      document.dispatchEvent(new CustomEvent('componentLoaded', {
        detail: { component: componentName, element: component }
      }));
      
    } catch (error) {
      console.error(`Error loading component ${componentName}:`, error);
    }
  }
  
  // Initialize components after they're loaded
  if (window.initComponents) {
    window.initComponents();
  }
}

// Load components when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  loadComponents().catch(console.error);
});
