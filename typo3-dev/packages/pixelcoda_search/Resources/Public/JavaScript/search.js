/**
 * PixelCoda Search - Filter Functions & Autocomplete
 */

// Debounce function for performance
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Autocomplete functionality
class SearchAutocomplete {
    constructor(inputElement) {
        this.input = inputElement;
        this.suggestionsContainer = null;
        this.currentFocus = -1;
        this.suggestions = [];
        this.isOpen = false;

        this.init();
    }

    init() {
        // Create suggestions container
        this.createSuggestionsContainer();

        // Add event listeners
        this.input.addEventListener('input', debounce((e) => this.handleInput(e), 300));
        this.input.addEventListener('keydown', (e) => this.handleKeydown(e));
        this.input.addEventListener('focus', () => this.handleFocus());

        // Close suggestions when clicking outside
        document.addEventListener('click', (e) => {
            if (!this.input.contains(e.target) && !this.suggestionsContainer.contains(e.target)) {
                this.closeSuggestions();
            }
        });
    }

    createSuggestionsContainer() {
        this.suggestionsContainer = document.createElement('div');
        this.suggestionsContainer.className = 'autocomplete-suggestions';
        this.suggestionsContainer.style.display = 'none';

        // Position it after the input wrapper
        const wrapper = this.input.closest('.search-input-wrapper') || this.input.parentElement;
        wrapper.style.position = 'relative';
        wrapper.appendChild(this.suggestionsContainer);
    }

    async handleInput(e) {
        const query = e.target.value.trim();

        if (query.length < 2) {
            this.closeSuggestions();
            return;
        }

        try {
            const response = await fetch(`/index.php?eID=search_suggest&q=${encodeURIComponent(query)}`);
            const suggestions = await response.json();

            if (suggestions && suggestions.length > 0) {
                this.displaySuggestions(suggestions);
            } else {
                this.closeSuggestions();
            }
        } catch (error) {
            console.error('Error fetching suggestions:', error);
            this.closeSuggestions();
        }
    }

    displaySuggestions(suggestions) {
        this.suggestions = suggestions;
        this.suggestionsContainer.innerHTML = '';

        suggestions.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'suggestion-item';
            div.dataset.index = index;

            // Create content based on type
            let content = '';
            const icon = this.getIconForType(item.type);

            if (item.subtitle) {
                content = `
                    <span class="suggestion-icon">${icon}</span>
                    <div class="suggestion-content">
                        <div class="suggestion-title">${this.highlightMatch(item.title)}</div>
                        <div class="suggestion-subtitle">${item.subtitle}</div>
                    </div>
                `;
            } else {
                content = `
                    <span class="suggestion-icon">${icon}</span>
                    <div class="suggestion-content">
                        <div class="suggestion-title">${this.highlightMatch(item.title)}</div>
                    </div>
                `;
            }

            div.innerHTML = content;

            // Add click handler
            div.addEventListener('click', () => {
                this.selectSuggestion(index);
            });

            // Add hover handler
            div.addEventListener('mouseenter', () => {
                this.currentFocus = index;
                this.updateActive();
            });

            this.suggestionsContainer.appendChild(div);
        });

        this.suggestionsContainer.style.display = 'block';
        this.isOpen = true;
        this.currentFocus = -1;
    }

    getIconForType(type) {
        switch (type) {
        case 'page':
            return '📄';
        case 'content':
            return '📝';
        case 'search':
            return '🔍';
        default:
            return '📋';
        }
    }

    highlightMatch(text) {
        const query = this.input.value.trim();
        const regex = new RegExp(`(${query})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    }

    handleKeydown(e) {
        if (!this.isOpen) return;

        switch (e.key) {
        case 'ArrowDown':
            e.preventDefault();
            this.currentFocus++;
            if (this.currentFocus >= this.suggestions.length) {
                this.currentFocus = 0;
            }
            this.updateActive();
            break;

        case 'ArrowUp':
            e.preventDefault();
            this.currentFocus--;
            if (this.currentFocus < 0) {
                this.currentFocus = this.suggestions.length - 1;
            }
            this.updateActive();
            break;

        case 'Enter':
            e.preventDefault();
            if (this.currentFocus > -1) {
                this.selectSuggestion(this.currentFocus);
            }
            break;

        case 'Escape':
            this.closeSuggestions();
            break;
        }
    }

    handleFocus() {
        if (this.input.value.length >= 2) {
            this.handleInput({
                target: this.input
            });
        }
    }

    updateActive() {
        const items = this.suggestionsContainer.querySelectorAll('.suggestion-item');
        items.forEach((item, index) => {
            if (index === this.currentFocus) {
                item.classList.add('active');
                // Scroll into view if needed
                item.scrollIntoView({
                    block: 'nearest'
                });
            } else {
                item.classList.remove('active');
            }
        });
    }

    selectSuggestion(index) {
        const suggestion = this.suggestions[index];
        if (suggestion) {
            if (suggestion.type === 'search') {
                // For search suggestions, fill the input
                this.input.value = suggestion.title;
                this.closeSuggestions();
                // Optionally submit the form
                const form = this.input.closest('form');
                if (form) {
                    form.submit();
                }
            } else {
                // For pages/content, navigate directly
                window.location.href = suggestion.url;
            }
        }
    }

    closeSuggestions() {
        this.suggestionsContainer.style.display = 'none';
        this.isOpen = false;
        this.currentFocus = -1;
        this.suggestions = [];
    }
}

// Toggle filter visibility
function toggleFilters() {
    const filterPanel = document.getElementById('searchFilters');
    const toggleButton = document.querySelector('.filter-toggle');

    if (filterPanel) {
        if (filterPanel.style.display === 'none' || filterPanel.style.display === '') {
            filterPanel.style.display = 'block';
            toggleButton.classList.add('active');
            // Save state to localStorage
            localStorage.setItem('searchFiltersOpen', 'true');
        } else {
            filterPanel.style.display = 'none';
            toggleButton.classList.remove('active');
            localStorage.setItem('searchFiltersOpen', 'false');
        }
    }
}

// Reset all filters
function resetFilters() {
    // Reset checkboxes
    document.querySelectorAll('.search-filters input[type="checkbox"]').forEach(checkbox => {
        checkbox.checked = false;
    });

    // Reset selects
    document.querySelectorAll('.search-filters select').forEach(select => {
        select.selectedIndex = 0;
    });

    // Reset date inputs
    document.querySelectorAll('.search-filters input[type="date"]').forEach(input => {
        input.value = '';
    });

    // Keep search query
    const searchQuery = document.querySelector('input[name="q"]').value;

    // Redirect with only search query
    window.location.href = '?q=' + encodeURIComponent(searchQuery);
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function () {
    // Initialize autocomplete for all search inputs
    const searchInputs = document.querySelectorAll('.search-input');
    const autocompleteInstances = [];
    searchInputs.forEach(input => {
        autocompleteInstances.push(new SearchAutocomplete(input));
    });

    // Restore filter panel state from localStorage
    const filtersOpen = localStorage.getItem('searchFiltersOpen');
    if (filtersOpen === 'true') {
        const filterPanel = document.getElementById('searchFilters');
        const toggleButton = document.querySelector('.filter-toggle');
        if (filterPanel && toggleButton) {
            filterPanel.style.display = 'block';
            toggleButton.classList.add('active');
        }
    }

    // Add event listeners for filter changes (auto-submit option)
    const autoSubmit = false; // Set to true if you want auto-submit on filter change

    if (autoSubmit) {
        document.querySelectorAll('.search-filters select, .search-filters input[type="checkbox"]').forEach(element => {
            element.addEventListener('change', function () {
                document.querySelector('.search-form').submit();
            });
        });
    }

    // Highlight search terms in results
    const searchQuery = document.querySelector('input[name="q"]');
    if (searchQuery && searchQuery.value) {
        highlightSearchTerms(searchQuery.value);
    }
});

// Highlight search terms in results
function highlightSearchTerms(query) {
    if (!query) return;

    const terms = query.toLowerCase().split(' ').filter(term => term.length > 2);
    const resultItems = document.querySelectorAll('.search-result-item');

    resultItems.forEach(item => {
        const title = item.querySelector('.search-result-title');
        const abstract = item.querySelector('.search-result-abstract');

        terms.forEach(term => {
            if (title) {
                highlightTextNode(title, term);
            }
            if (abstract) {
                highlightTextNode(abstract, term);
            }
        });
    });
}

// Helper function to highlight text
function highlightTextNode(element, term) {
    const regex = new RegExp('(' + term + ')', 'gi');
    const originalText = element.textContent;
    const highlightedText = originalText.replace(regex, '<mark>$1</mark>');

    if (originalText !== highlightedText) {
        element.innerHTML = highlightedText;
    }
}

// Export functions for global use
window.toggleFilters = toggleFilters;
window.resetFilters = resetFilters;
