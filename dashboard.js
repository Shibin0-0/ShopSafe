let inventoryData = [];
let catalogData = [];
let currentFilter = 'All';
const STORAGE_KEY = 'shopsafe_inventory';
const CATALOG_KEY = 'shopsafe_catalog';
const API_URL = 'http://127.0.0.1:5000/api/products';
let currentDetailId = null;
let currentSearchQuery = '';

// DOM Elements
const inventoryTbody = document.getElementById('inventory-tbody');
const addProductForm = document.getElementById('add-product-form');
const pnInput = document.getElementById('p-name');
const pcInput = document.getElementById('p-cat');

const scannerModal = document.getElementById('scanner-modal');
const btnScan = document.getElementById('btn-scan');
const closeScanner = document.getElementById('close-scanner');
const scannerStatus = document.getElementById('scanner-status');
let html5QrcodeScanner = null;

// Tab Management
window.switchTab = function (tab) {
    const overview = document.getElementById('overview-section');
    const analytics = document.getElementById('analytics-section');
    const aiWarnings = document.getElementById('ai-warnings-section');
    const catalog = document.getElementById('catalog-section');
    const inventory = document.getElementById('inventory-section');
    const addItem = document.getElementById('add-item-section');
    const searchResults = document.getElementById('search-results-section');
    const settings = document.getElementById('settings-section');

    // Controls
    const invControls = document.getElementById('inventory-controls');

    const navOverview = document.getElementById('nav-overview');
    const navAnalytics = document.getElementById('nav-analytics');
    const navAiWarnings = document.getElementById('nav-ai-warnings');
    const navCatalog = document.getElementById('nav-catalog');
    const navInventory = document.getElementById('nav-inventory');
    const navAddItem = document.getElementById('nav-add-item');
    const navSearchResults = document.getElementById('nav-search-results');
    const navSettings = document.getElementById('nav-settings');

    // Reset displays
    [overview, analytics, aiWarnings, catalog, inventory, addItem, searchResults, settings].forEach(sect => {
        if (sect) sect.style.display = 'none';
    });
    [navOverview, navAnalytics, navAiWarnings, navCatalog, navInventory, navAddItem, navSearchResults, navSettings].forEach(nav => {
        if (nav) nav.classList.remove('active');
    });
    if (invControls) invControls.style.display = 'none';

    if (tab === 'analytics') {
        analytics.style.display = 'flex';
        navAnalytics.classList.add('active');
        renderAnalytics();
    } else if (tab === 'ai-warnings') {
        aiWarnings.style.display = 'flex';
        navAiWarnings.classList.add('active');
        generateAiExpiryWarnings();
    } else if (tab === 'catalog') {
        if (catalog) catalog.style.display = 'grid';
        if (navCatalog) navCatalog.classList.add('active');
        renderCatalog();
    } else if (tab === 'settings') {
        if (settings) settings.style.display = 'flex';
        if (navSettings) navSettings.classList.add('active');
    } else if (tab === 'inventory') {
        inventory.style.display = 'block';
        invControls.style.display = 'flex';
        navInventory.classList.add('active');
        renderInventory();
    } else if (tab === 'add-item') {
        addItem.style.display = 'block';
        navAddItem.classList.add('active');
    } else if (tab === 'search-results') {
        searchResults.style.display = 'block';
        navSearchResults.style.display = 'flex';
        navSearchResults.classList.add('active');
    } else {
        overview.style.display = 'grid'; // Hub uses grid
        navOverview.classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
};

document.addEventListener('DOMContentLoaded', () => {

    // --- Initialize Data ---
    loadInventory();
    loadCatalog();
    setupGlobalSearch();

    // --- Detail Modal Close ---
    const detailModal = document.getElementById('product-detail-modal');
    const closeBtn = document.getElementById('close-product-detail');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            detailModal.style.display = 'none';
        });
    }

    // --- Barcode Scanner ---
    btnScan.addEventListener('click', () => {
        scannerModal.style.display = 'flex';
        setTimeout(() => scannerModal.classList.add('active'), 10);
        startScanner();
    });

    closeScanner.addEventListener('click', stopScanner);

    // --- Add Product Form ---
    addProductForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const btn = document.getElementById('btn-submit-product');
        const originalText = btn.innerText;
        btn.innerText = 'Saving...';
        // Get hidden barcode data
        const iUrl = document.getElementById('p-image-url').value;
        const bCode = document.getElementById('p-barcode').value;

        btn.disabled = true;
        btn.innerText = 'Adding...';

        const idInput = (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : 'PRD-' + Date.now().toString(36).toUpperCase();
        const name = pnInput.value.trim();
        const mfg = document.getElementById('p-mfg-name').value.trim();
        const cat = pcInput.value;
        const qty = parseInt(document.getElementById('p-qty').value) || 1;
        const batch = document.getElementById('p-batch').value.trim();
        const mfg_date = document.getElementById('p-mfg').value || null;
        const exp_date = document.getElementById('p-exp').value;

        const newItem = {
            id: idInput,
            name,
            manufacturer: mfg,
            category: cat,
            quantity: qty,
            batch_number: batch,
            mfg_date: mfg_date,
            exp_date: exp_date,
            imageUrl: iUrl,
            barcode: bCode,
            created_at: new Date().toISOString()
        };

        try {
            // Send to Backend
            const backendRes = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    productId: newItem.id,
                    name: newItem.name,
                    company: newItem.manufacturer,
                    category: newItem.category,
                    quantity: newItem.quantity,
                    batchNumber: newItem.batch_number,
                    manufactureDate: newItem.mfg_date,
                    expiryDate: newItem.exp_date,
                    imageUrl: newItem.imageUrl,
                    barcode: newItem.barcode
                })
            });

            if (!backendRes.ok) throw new Error("Backend save failed");

            const savedProduct = await backendRes.json();
            newItem.id = savedProduct._id; // Replace local ID with DB ID

            inventoryData.unshift(newItem); // Add to local state
            // saveInventory(); // No need to save locally if backend is successful
            renderInventory();
            updateStats();
            generateAiExpiryWarnings();
            renderAnalytics();

            createToast({ title: 'Success', msg: `${name} added successfully!`, type: 'success', icon: 'ph-check-circle', color: 'var(--safe)' });

            addProductForm.reset();
            // Reset image preview
            document.getElementById('scanned-image-preview').style.display = 'none';
            document.getElementById('p-image-url').value = '';
            document.getElementById('p-barcode').value = '';

            pnInput.focus();

        } catch (e) {
            console.error(e);
            inventoryData.push(newItem);
            saveInventory();
            renderInventory();
            updateStats();
            generateAiExpiryWarnings();
            renderAnalytics();

            createToast({ title: 'Success (Offline)', msg: `${name} added locally. Will sync later.`, type: 'success', icon: 'ph-check-circle', color: 'var(--safe)' });

            addProductForm.reset();
            // Reset image preview
            document.getElementById('scanned-image-preview').style.display = 'none';
            document.getElementById('p-image-url').value = '';
            document.getElementById('p-barcode').value = '';

            pnInput.focus();
        } finally {
            btn.innerText = originalText;
            btn.disabled = false;
        }
    });

    // Controls
    const filterPills = document.querySelectorAll('.filter-pill');
    filterPills.forEach(pill => {
        pill.addEventListener('click', (e) => {
            filterPills.forEach(p => p.classList.remove('active'));
            e.target.classList.add('active');
            currentFilter = e.target.dataset.filter;
            renderInventory();
        });
    });

    // Custom Sort Dropdown
    let currentSortOption = 'date_desc';
    const sortDropdown = document.getElementById('sort-dropdown');
    const sortTrigger = document.getElementById('sort-trigger');
    const sortMenu = document.getElementById('sort-menu');
    const sortLabel = document.getElementById('sort-label');
    const sortItems = document.querySelectorAll('.dropdown-item');

    if (sortTrigger && sortMenu) {
        sortTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            sortMenu.classList.toggle('active');
        });

        sortItems.forEach(item => {
            item.addEventListener('click', (e) => {
                sortItems.forEach(i => i.classList.remove('selected'));
                e.target.classList.add('selected');
                currentSortOption = e.target.dataset.sort;
                sortLabel.innerText = e.target.innerText;
                sortMenu.classList.remove('active');
                renderInventory();
            });
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!sortDropdown.contains(e.target)) {
                sortMenu.classList.remove('active');
            }
        });
    }

    // --- Migrate Local Data to Backend ---
    async function migrateLocalStorage() {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                const localData = JSON.parse(stored);
                if (localData.length > 0) {
                    console.log("Migrating local data to backend...");
                    for (const item of localData) {
                        try {
                            await fetch(API_URL, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    name: item.name,
                                    company: item.manufacturer,
                                    category: item.category,
                                    quantity: item.quantity || 1,
                                    batchNumber: item.batch_number,
                                    manufactureDate: item.mfg_date,
                                    expiryDate: item.exp_date,
                                    imageUrl: item.imageUrl,
                                    barcode: item.barcode
                                })
                            });
                        } catch (e) { console.warn("Failed to migrate item:", item.name); }
                    }
                    localStorage.removeItem(STORAGE_KEY);
                    console.log("Migration complete.");
                    loadInventory(); // Reload from backend
                }
            } catch (e) {
                console.error("Migration failed", e);
            }
        }
    }
    migrateLocalStorage();

    // --- Catalog Form ---
    const addCatalogForm = document.getElementById('add-catalog-form');
    if (addCatalogForm) {
        addCatalogForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('cat-p-name').value.trim();
            const mfg = document.getElementById('cat-p-mfg').value.trim();

            const newItem = {
                id: (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : Date.now().toString(36),
                name,
                manufacturer: mfg
            };

            catalogData.push(newItem);
            saveCatalog();
            renderCatalog();
            addCatalogForm.reset();
            createToast({ title: 'Added', msg: 'Product added to catalog.', type: 'success', icon: 'ph-check-circle', color: 'var(--primary-color)' });
        });
    }

    // --- Catalog Search Bar ---
    const catalogSearchInput = document.getElementById('catalog-search');
    const catalogSearchClear = document.getElementById('catalog-search-clear');

    if (catalogSearchInput) {
        catalogSearchInput.addEventListener('input', () => {
            const query = catalogSearchInput.value.trim().toLowerCase();

            // Show / hide the clear ✕ button
            if (catalogSearchClear) {
                catalogSearchClear.style.display = query ? 'block' : 'none';
            }

            const tbody = document.getElementById('catalog-tbody');
            if (!tbody) return;

            if (!query) {
                // No filter active — do a full render
                renderCatalog();
                return;
            }

            // Filter catalogData and render matching rows inline
            const matches = catalogData.filter(item =>
                item.name.toLowerCase().includes(query) ||
                (item.manufacturer && item.manufacturer.toLowerCase().includes(query))
            );

            tbody.innerHTML = '';

            if (matches.length === 0) {
                tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; padding: 2rem; color: var(--text-muted);">No catalog items match "<strong>${catalogSearchInput.value}</strong>"</td></tr>`;
                return;
            }

            matches.forEach(item => {
                // Highlight matched portion
                const hl = (str, q) => str.replace(
                    new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'),
                    '<mark style="background: rgba(124,58,237,0.25); color: var(--primary-color); border-radius: 2px; padding: 0 2px;">$1</mark>'
                );

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${hl(item.name, query)}</strong></td>
                    <td>${hl(item.manufacturer || '', query)}</td>
                    <td><button class="btn-delete" onclick="deleteCatalogItem('${item.id}')" title="Delete"><i class="ph ph-trash"></i></button></td>
                `;
                tbody.appendChild(tr);
            });
        });
    }

    // --- Custom Suggestions Logic ---
    const suggestionBox = document.getElementById('custom-suggestions');

    pnInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        if (!query) {
            suggestionBox.classList.remove('active');
            return;
        }

        const currentMfg = document.getElementById('p-mfg-name').value.trim().toLowerCase();

        let matches;
        if (currentMfg) {
            // If manufacturer is present, only show products from that manufacturer
            matches = catalogData.filter(item =>
                item.manufacturer.toLowerCase() === currentMfg &&
                item.name.toLowerCase().includes(query)
            );
        } else {
            // Otherwise, search across both name and manufacturer (original behavior)
            matches = catalogData.filter(item =>
                item.name.toLowerCase().includes(query) ||
                item.manufacturer.toLowerCase().includes(query)
            );
        }

        if (matches.length > 0) {
            suggestionBox.innerHTML = matches.map(item => `
                <div class="suggestion-item" onclick="selectSuggestion('${item.name.replace(/'/g, "\\'")}', '${item.manufacturer.replace(/'/g, "\\'")}')">
                    <strong>${item.name}</strong>
                    <small>${item.manufacturer}</small>
                </div>
            `).join('');
            suggestionBox.classList.add('active');
        } else {
            suggestionBox.classList.remove('active');
        }
    });

    window.selectSuggestion = function (name, mfg) {
        pnInput.value = name;
        document.getElementById('p-mfg-name').value = mfg;
        suggestionBox.classList.remove('active');
    };

    // --- Manufacturer Suggestions logic ---
    const setupMfgSuggestions = (inputEl, suggestionBoxEl, selectFuncName) => {
        if (!inputEl || !suggestionBoxEl) return;

        inputEl.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            if (!query) {
                suggestionBoxEl.classList.remove('active');
                return;
            }

            const uniqueMfgs = [...new Set(catalogData.map(item => item.manufacturer))]
                .filter(mfg => mfg.toLowerCase().includes(query));

            if (uniqueMfgs.length > 0) {
                suggestionBoxEl.innerHTML = uniqueMfgs.map(mfg => `
                    <div class="suggestion-item" onclick="${selectFuncName}('${mfg.replace(/'/g, "\\'")}')">
                        <strong>${mfg}</strong>
                    </div>
                `).join('');
                suggestionBoxEl.classList.add('active');
            } else {
                suggestionBoxEl.classList.remove('active');
            }
        });
    };

    const catalogMfgInput = document.getElementById('cat-p-mfg');
    const catalogMfgSuggestionBox = document.getElementById('catalog-mfg-suggestions');
    const addItemMfgInput = document.getElementById('p-mfg-name');
    const addItemMfgSuggestionBox = document.getElementById('p-mfg-suggestions');

    setupMfgSuggestions(catalogMfgInput, catalogMfgSuggestionBox, 'selectCatalogMfg');
    setupMfgSuggestions(addItemMfgInput, addItemMfgSuggestionBox, 'selectItemMfg');

    window.selectCatalogMfg = function (mfg) {
        catalogMfgInput.value = mfg;
        catalogMfgSuggestionBox.classList.remove('active');
    };

    window.selectItemMfg = function (mfg) {
        addItemMfgInput.value = mfg;
        addItemMfgSuggestionBox.classList.remove('active');
    };

    // --- Notifications Dropdown Logic ---
    const notificationBtn = document.getElementById('simulate-alert');
    const notificationDropdown = document.getElementById('notification-dropdown');

    if (notificationBtn) {
        notificationBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (notificationDropdown.style.display === 'none' || !notificationDropdown.style.display) {
                notificationDropdown.style.display = 'block';
            } else {
                notificationDropdown.style.display = 'none';
            }
        });
    }

    // Close on click outside
    document.addEventListener('click', (e) => {
        if (!pnInput.contains(e.target) && !suggestionBox.contains(e.target)) {
            suggestionBox.classList.remove('active');
        }
        if (catalogMfgInput && !catalogMfgInput.contains(e.target) && !catalogMfgSuggestionBox.contains(e.target)) {
            catalogMfgSuggestionBox.classList.remove('active');
        }
        if (addItemMfgInput && !addItemMfgInput.contains(e.target) && !addItemMfgSuggestionBox.contains(e.target)) {
            addItemMfgSuggestionBox.classList.remove('active');
        }
        if (notificationDropdown && !notificationDropdown.contains(e.target) && !notificationBtn.contains(e.target)) {
            notificationDropdown.style.display = 'none';
        }
    });

    // --- Import/Export/Clear Listeners ---
    const btnExportCatalog = document.getElementById('btn-export-catalog');
    const btnImportCatalog = document.getElementById('btn-import-catalog');
    const importCatalogFile = document.getElementById('import-catalog-file');

    if (btnExportCatalog) btnExportCatalog.addEventListener('click', handleExportCatalog);
    if (btnImportCatalog) btnImportCatalog.addEventListener('click', () => importCatalogFile.click());
    if (importCatalogFile) importCatalogFile.addEventListener('change', (e) => handleImportCatalog(e));

    // Custom Clear Catalog Modal Logic
    const confirmClearModal = document.getElementById('confirm-clear-modal');
    const btnCancelClear = document.getElementById('btn-cancel-clear');
    const btnConfirmClear = document.getElementById('btn-confirm-clear');

    if (btnCancelClear) {
        btnCancelClear.addEventListener('click', () => {
            confirmClearModal.classList.remove('active');
            setTimeout(() => confirmClearModal.style.display = 'none', 300);
        });
    }

    if (btnConfirmClear) {
        btnConfirmClear.addEventListener('click', () => {
            localStorage.removeItem(CATALOG_KEY);
            catalogData = [];
            renderCatalog();
            confirmClearModal.classList.remove('active');
            setTimeout(() => confirmClearModal.style.display = 'none', 300);
            createToast({ title: 'Catalog Cleared', msg: 'All catalog templates have been wiped.', type: 'success', icon: 'ph-check-circle', color: 'var(--safe)' });
        });
    }

    const btnExportInventory = document.getElementById('btn-export-inventory');
    const btnImportInventory = document.getElementById('btn-import-inventory');
    const importInventoryFile = document.getElementById('import-inventory-file');
    const btnClearInventory = document.getElementById('btn-clear-inventory');

    if (btnExportInventory) btnExportInventory.addEventListener('click', handleExportInventory);
    if (btnImportInventory) btnImportInventory.addEventListener('click', () => importInventoryFile.click());
    if (importInventoryFile) importInventoryFile.addEventListener('change', (e) => handleImportInventory(e));
    if (btnClearInventory) btnClearInventory.addEventListener('click', handleClearInventory);

    // --- Core Data Functions ---

    async function loadInventory() {
        // Update UI status
        const dbStatus = document.getElementById('db-status-badge');
        if (dbStatus) {
            dbStatus.innerText = "Connecting to Backend...";
            dbStatus.style.background = "var(--primary-light)";
            dbStatus.style.color = "var(--primary-color)";
        }

        try {
            const response = await fetch(API_URL);
            if (!response.ok) throw new Error('Failed to fetch from backend');

            const products = await response.json();
            // Map backend fields to frontend fields if necessary
            inventoryData = products.map(p => ({
                id: p._id,
                name: p.name,
                manufacturer: p.company,
                category: p.category,
                quantity: p.quantity || 1,
                batch_number: p.batchNumber || p.batch_number || '-',
                mfg_date: p.manufactureDate,
                exp_date: p.expiryDate,
                created_at: p.createdAt,
                imageUrl: p.imageUrl || '',
                barcode: p.barcode || ''
            }));

            if (dbStatus) {
                dbStatus.innerText = "Connected to Database";
                dbStatus.style.background = "var(--safe-light)";
                dbStatus.style.color = "var(--safe)";
            }
        } catch (e) {
            console.error("Backend unavailable, loading from local storage", e);
            if (dbStatus) {
                dbStatus.innerText = "Backend Offline - Local Mode";
                dbStatus.style.background = "var(--danger-light)";
                dbStatus.style.color = "var(--danger)";
            }
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                inventoryData = JSON.parse(stored);
            }
        }

        // Sort by creation date descending (newest first) by default
        inventoryData.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        renderInventory();
        updateStats();
        generateAiExpiryWarnings();
        renderAnalytics();
        checkAlerts(false);
    }

    function saveInventory() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(inventoryData));
        } catch (e) {
            console.error("Failed to save to local storage", e);
            alert("Warning: Your browser is blocking local storage. Data will not be saved after you close the page.");
        }
    }

    function getExpiryStatus(expDateStr) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const expDate = new Date(expDateStr);
        const diffTime = expDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) return { status: 'danger', label: 'Expired', days: diffDays };
        if (diffDays === 0) return { status: 'danger', label: 'Expires Today', days: 0 };
        if (diffDays <= 7) return { status: 'warning', label: `${diffDays} Day${diffDays !== 1 ? 's' : ''}`, days: diffDays };

        if (diffDays > 30) {
            const months = Math.floor(diffDays / 30);
            return { status: 'safe', label: `${months} Month${months !== 1 ? 's' : ''}`, days: diffDays };
        }
        return { status: 'safe', label: `${diffDays} Days`, days: diffDays };
    }

    function renderInventory() {
        inventoryTbody.innerHTML = '';

        let filteredData = [...inventoryData];
        if (currentFilter !== 'All') {
            filteredData = filteredData.filter(item => item.category === currentFilter);
        }

        if (currentSearchQuery) {
            const q = currentSearchQuery.toLowerCase();
            filteredData = filteredData.filter(item =>
                item.name.toLowerCase().includes(q) ||
                (item.manufacturer && item.manufacturer.toLowerCase().includes(q))
            );
        }

        const sortOption = currentSortOption;

        filteredData.sort((a, b) => {
            switch (sortOption) {
                case 'expiry_asc': return new Date(a.exp_date) - new Date(b.exp_date);
                case 'expiry_desc': return new Date(b.exp_date) - new Date(a.exp_date);
                case 'name_asc': return a.name.localeCompare(b.name);
                case 'name_desc': return b.name.localeCompare(a.name);
                case 'mfg_asc': return (a.manufacturer || '').localeCompare(b.manufacturer || '');
                case 'mfg_desc': return (b.manufacturer || '').localeCompare(a.manufacturer || '');
                case 'qty_asc': return (parseInt(a.quantity) || 0) - (parseInt(b.quantity) || 0);
                case 'qty_desc': return (parseInt(b.quantity) || 0) - (parseInt(a.quantity) || 0);
                case 'date_asc': return new Date(a.created_at) - new Date(b.created_at);
                case 'date_desc': default: return new Date(b.created_at) - new Date(a.created_at);
            }
        });

        if (filteredData.length === 0) {
            inventoryTbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 2rem; color: var(--text-muted);">No items yet. Add one to get started!</td></tr>`;
            return;
        }

        filteredData.forEach(item => {
            const expInfo = getExpiryStatus(item.exp_date);

            const tr = document.createElement('tr');
            tr.className = `status-row-${expInfo.status}`;
            tr.style.cursor = 'pointer';
            tr.onclick = (e) => {
                if (e.target.closest('button')) return;
                openProductDetail(item.id);
            };
            tr.innerHTML = `
            <td><strong>${item.name}</strong></td>
            <td>${item.manufacturer || '-'}</td>
            <td>${item.category}</td>
            <td>${item.batch_number || '-'}</td>
            <td><span class="qty-badge">${item.quantity || 1}</span></td>
            <td>${new Date(item.exp_date).toLocaleDateString()}</td>
            <td><span class="status-badge ${expInfo.status}">${expInfo.label}</span></td>
            <td><button class="btn-delete" onclick="deleteItem('${item.id}')" title="Delete"><i class="ph ph-trash"></i></button></td>
        `;
            inventoryTbody.appendChild(tr);
        });
    }

    function updateStats() {
        let safe = 0, warning = 0, danger = 0;

        inventoryData.forEach(item => {
            const expInfo = getExpiryStatus(item.exp_date);
            if (expInfo.status === 'safe') safe++;
            if (expInfo.status === 'warning') warning++;
            if (expInfo.status === 'danger') danger++;
        });

        document.querySelector('.safe-stat .value').innerText = safe;
        document.querySelector('.warning-stat .value').innerText = warning;
        document.querySelector('.danger-stat .value').innerText = danger;
    }

    // Make globally available for onclick
    window.deleteItem = async function (id) {
        if (!confirm('Delete this item?')) return;

        try {
            const response = await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Delete failed');

            inventoryData = inventoryData.filter(item => item.id !== id);
            createToast({ title: 'Deleted', msg: 'Item removed from database.', type: 'info', icon: 'ph-trash', color: 'var(--text-muted)' });
        } catch (err) {
            console.error(err);
            // Fallback remove from state/local
            inventoryData = inventoryData.filter(item => item.id !== id);
            saveInventory();
            createToast({ title: 'Warning', msg: 'Deleted locally, backend sync failed.', type: 'warning', icon: 'ph-warning', color: 'var(--warning)' });
        }

        renderInventory();
        updateStats();
        generateAiExpiryWarnings();
        renderAnalytics();
    };

    // --- Alerts ---
    function checkAlerts(forceToast = false) {
        let alertingItems = [];
        inventoryData.forEach(item => {
            const expInfo = getExpiryStatus(item.exp_date);
            if (expInfo.status === 'danger' || expInfo.status === 'warning') {
                alertingItems.push({ item, expInfo });
            }
        });

        if (alertingItems.length > 0 && forceToast) {
            // Show random alert from the pool
            const alert = alertingItems[Math.floor(Math.random() * alertingItems.length)];
            const isExp = alert.expInfo.status === 'danger';
            createToast({
                title: isExp ? 'Item Expired!' : 'Expiring Soon',
                msg: `${alert.item.name} ${isExp ? 'has expired (' + alert.expInfo.label + ')' : 'is expiring in ' + alert.expInfo.days + ' days'}.`,
                type: alert.expInfo.status,
                icon: isExp ? 'ph-warning-octagon' : 'ph-warning-circle',
                color: isExp ? 'var(--danger)' : 'var(--warning)'
            });

            // Pulse bell
            const bellBtn = document.getElementById('simulate-alert');
            if (bellBtn) {
                const bell = bellBtn.querySelector('i');
                bell.style.transform = 'scale(1.2)';
                setTimeout(() => { bell.style.transform = 'scale(1)'; }, 200);
            }
        } else if (forceToast) {
            createToast({
                title: 'All Good!',
                msg: 'None of your items are expiring soon.',
                type: 'safe',
                icon: 'ph-check-circle',
                color: 'var(--safe)'
            });
        }
    }

    function createToast(data) {
        const toastContainer = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.classList.add('toast');
        toast.style.borderLeftColor = data.color;

        toast.innerHTML = `
        <i class="ph-fill ${data.icon}" style="color: ${data.color}"></i>
        <div class="toast-body">
            <span class="toast-title">${data.title}</span>
            <span class="toast-msg">${data.msg}</span>
        </div>
    `;

        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('removing');
            toast.addEventListener('animationend', () => toast.remove());
        }, 4000);
    }

    // --- AI Expiry Warnings ---
    function generateAiExpiryWarnings() {
        const alertsContainer = document.getElementById('ai-expiry-alerts-container');
        if (!alertsContainer) return;

        if (inventoryData.length === 0) {
            alertsContainer.innerHTML = '<div style="font-size: 0.875rem; color: var(--text-muted);">No items in inventory to analyze.</div>';
            return;
        }

        const warnings = inventoryData.filter(item => getExpiryStatus(item.exp_date).status === 'warning');
        const expired = inventoryData.filter(item => getExpiryStatus(item.exp_date).status === 'danger');

        let html = '';

        if (expired.length > 0) {
            expired.forEach(item => {
                html += `
                    <div style="display: flex; align-items: flex-start; gap: 0.5rem; color: var(--danger); font-size: 0.875rem; background: rgba(239, 68, 68, 0.1); padding: 0.75rem; border-radius: 8px;">
                        <i class="ph-fill ph-x-circle" style="font-size: 1.125rem; flex-shrink: 0;"></i>
                        <div>
                            <strong>${item.name}</strong>
                            <div style="margin-top: 0.25rem;">\u274C This product is already expired</div>
                        </div>
                    </div>
                `;
            });
        }

        if (warnings.length > 0) {
            // Sort by closest expiry
            warnings.sort((a, b) => new Date(a.exp_date) - new Date(b.exp_date));
            warnings.forEach(item => {
                const daysObj = getExpiryStatus(item.exp_date);
                const days = daysObj.days === 0 ? '0' : daysObj.days;
                html += `
                    <div style="display: flex; align-items: flex-start; gap: 0.5rem; color: var(--warning); font-size: 0.875rem; background: rgba(245, 158, 11, 0.1); padding: 0.75rem; border-radius: 8px;">
                        <i class="ph-fill ph-warning-circle" style="font-size: 1.125rem; flex-shrink: 0;"></i>
                        <div>
                            <strong>${item.name}</strong>
                            <div style="margin-top: 0.25rem;">\u26A0\uFE0F This product will expire in ${days} days</div>
                        </div>
                    </div>
                `;
            });
        }

        if (!html) {
            html = '<div style="font-size: 0.875rem; color: var(--safe); display: flex; align-items: center; gap: 0.5rem;"><i class="ph-fill ph-check-circle"></i> All your items look great! Your inventory is healthy and nothing is expiring soon.</div>';
        }

        alertsContainer.innerHTML = html;

        updateNotificationDropdown();
    }

    function updateNotificationDropdown() {
        const notifList = document.getElementById('notification-list');
        const notifBadge = document.getElementById('notification-badge');
        if (!notifList || !notifBadge) return;

        const warnings = inventoryData.filter(item => getExpiryStatus(item.exp_date).status === 'warning');
        const expired = inventoryData.filter(item => getExpiryStatus(item.exp_date).status === 'danger');

        const totalAlerts = warnings.length + expired.length;

        if (totalAlerts > 0) {
            notifBadge.innerText = totalAlerts > 9 ? '9+' : totalAlerts;
            notifBadge.style.display = 'flex';
        } else {
            notifBadge.style.display = 'none';
        }

        let html = '';

        if (expired.length > 0) {
            expired.sort((a, b) => new Date(b.exp_date) - new Date(a.exp_date)).slice(0, 5).forEach(item => {
                html += `
                    <div style="display: flex; align-items: flex-start; gap: 0.5rem; color: var(--danger); font-size: 0.8125rem; background: rgba(239, 68, 68, 0.1); padding: 0.5rem; border-radius: 6px;">
                        <i class="ph-fill ph-x-circle" style="font-size: 1rem; flex-shrink: 0; margin-top: 0.1rem;"></i>
                        <div>
                            <strong>${item.name}</strong> has expired
                        </div>
                    </div>
                `;
            });
        }

        if (warnings.length > 0) {
            warnings.sort((a, b) => new Date(a.exp_date) - new Date(b.exp_date)).slice(0, 5 - Math.min(expired.length, 5)).forEach(item => {
                const daysObj = getExpiryStatus(item.exp_date);
                const days = daysObj.days === 0 ? '0' : daysObj.days;
                html += `
                    <div style="display: flex; align-items: flex-start; gap: 0.5rem; color: var(--warning); font-size: 0.8125rem; background: rgba(245, 158, 11, 0.1); padding: 0.5rem; border-radius: 6px;">
                        <i class="ph-fill ph-warning-circle" style="font-size: 1rem; flex-shrink: 0; margin-top: 0.1rem;"></i>
                        <div>
                            <strong>${item.name}</strong> will expire in ${days} days
                        </div>
                    </div>
                `;
            });
        }

        if (!html) {
            html = '<div style="font-size: 0.875rem; color: var(--text-muted); padding: 0.5rem 0;">No new notifications</div>';
        }

        notifList.innerHTML = html;
    }


    // --- Barcode Scanner Logic ---
    function startScanner() {
        scannerStatus.innerText = "Requesting camera access...";
        html5QrcodeScanner = new Html5Qrcode("reader");

        const config = { fps: 10, qrbox: { width: 250, height: 150 } };

        html5QrcodeScanner.start({ facingMode: "environment" }, config, onScanSuccess, onScanFailure)
            .then(() => {
                scannerStatus.innerText = "Point your camera at a barcode...";
            })
            .catch((err) => {
                scannerStatus.innerText = "Error accessing camera. Please ensure permissions are granted.";
                console.error(err);
            });
    }

    function stopScanner() {
        if (html5QrcodeScanner) {
            html5QrcodeScanner.stop().then(() => {
                html5QrcodeScanner.clear();
            }).catch(err => console.log(err));
        }
        scannerModal.classList.remove('active');
        setTimeout(() => { scannerModal.style.display = 'none'; }, 300);
    }

    async function handleBarcodeData(barcode) {
        const spinner = document.getElementById('scanner-spinner');
        const manualInput = document.getElementById('manual-barcode-input');

        if (spinner) spinner.style.display = 'flex';
        scannerStatus.innerText = `Fetching details for ${barcode}...`;

        try {
            const response = await fetch(`${API_URL}/barcode/${barcode}`);

            if (!response.ok) {
                if (response.status === 404) throw new Error("Product not found in database.");
                throw new Error("Failed to fetch product data.");
            }

            const data = await response.json();

            // Fill the "Add Item" form fields
            pnInput.value = data.name;
            document.getElementById('p-mfg-name').value = data.brand;

            // Basic categorization logic
            const tags = (data.categories || "").toLowerCase();
            if (tags.includes('beverage')) {
                pcInput.value = 'Beverage';
            } else if (tags.includes('snack') || tags.includes('confectionery')) {
                pcInput.value = 'Snacks';
            } else if (tags.includes('dairy') || tags.includes('milk')) {
                pcInput.value = 'Dairy';
            } else if (tags.includes('frozen') || tags.includes('ice cream')) {
                pcInput.value = 'Frozen';
            } else if (tags.includes('health') || tags.includes('medicine') || tags.includes('vitamin')) {
                pcInput.value = 'Health';
            } else if (tags.includes('food') || tags.includes('grocery')) {
                pcInput.value = 'Food';
            } else {
                pcInput.value = 'Other';
            }

            // Handle Image & Barcode Hidden Fields
            const previewContainer = document.getElementById('scanned-image-preview');
            const imgElement = document.getElementById('scanned-img');
            const urlHidden = document.getElementById('p-image-url');
            const barcodeHidden = document.getElementById('p-barcode');
            const textDisplay = document.getElementById('scanned-barcode-text');

            if (data.imageUrl) {
                imgElement.src = data.imageUrl;
                urlHidden.value = data.imageUrl;
                previewContainer.style.display = 'block';
            } else {
                imgElement.src = '';
                urlHidden.value = '';
                previewContainer.style.display = 'block'; // Still show for barcode text
            }

            barcodeHidden.value = data.barcode;
            textDisplay.innerText = `Scanned Barcode: ${data.barcode}`;

            // Clean up and switch tab
            if (manualInput) manualInput.value = '';
            stopScanner();
            window.switchTab('add-item');

            createToast({
                title: 'Product Found',
                msg: `Auto-filled details for ${data.name}. Please enter expiry date.`,
                type: 'success',
                icon: 'ph-scan',
                color: 'var(--primary-color)'
            });

            // Focus expiry date to guide user
            setTimeout(() => {
                const expInput = document.getElementById('p-exp');
                if (expInput) expInput.focus();
            }, 500);

        } catch (err) {
            console.error(err);
            createToast({ title: 'Lookup Failed', msg: err.message, type: 'warning', icon: 'ph-warning', color: 'var(--warning)' });
            scannerStatus.innerText = err.message;
        } finally {
            if (spinner) spinner.style.display = 'none';
        }
    }

    async function onScanSuccess(decodedText) {
        // Stop scanning visually, wait for data
        if (html5QrcodeScanner) {
            html5QrcodeScanner.pause();
        }
        await handleBarcodeData(decodedText);
    }

    // Manual Barcode Lookup
    const btnManualLookup = document.getElementById('btn-manual-lookup');
    if (btnManualLookup) {
        btnManualLookup.addEventListener('click', () => {
            const input = document.getElementById('manual-barcode-input');
            const code = input.value.trim();
            if (code) {
                handleBarcodeData(code);
            } else {
                createToast({ title: 'Input Required', msg: 'Please enter a barcode number.', type: 'warning', icon: 'ph-warning', color: 'var(--warning)' });
            }
        });
    }

    function onScanFailure(error) {
        // ignore frequent errors
    }

    // --- Analytics Rendering ---
    function renderAnalytics() {
        const catContainer = document.getElementById('analytics-categories');
        const statusContainer = document.getElementById('analytics-status');
        if (!catContainer || !statusContainer) return;

        // 1. Category Breakdown
        const categories = [
            'Food', 'Snacks', 'Beverage', 'Dairy', 'Grocery', 'Frozen',
            'Baking', 'Dessert', 'Dry Fruits', 'Health',
            'Condiment', 'Breakfast', 'Confectionery', 'Other'
        ];
        const catCounts = {};
        categories.forEach(c => catCounts[c] = 0);
        inventoryData.forEach(item => {
            if (catCounts[item.category] !== undefined) catCounts[item.category]++;
        });

        const maxCat = Math.max(...Object.values(catCounts), 1);
        catContainer.innerHTML = categories.map(cat => `
        <div class="analytics-row">
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.875rem;">
                <span>${cat}</span>
                <strong>${catCounts[cat]} Items</strong>
            </div>
            <div style="height: 8px; background: var(--secondary-color); border-radius: 4px; overflow: hidden;">
                <div style="width: ${(catCounts[cat] / maxCat) * 100}%; height: 100%; background: var(--primary-color); border-radius: 4px; transition: width 1s ease;"></div>
            </div>
        </div>
    `).join('');

        // 2. Status Breakdown
        let safe = 0, warning = 0, danger = 0;
        inventoryData.forEach(item => {
            const info = getExpiryStatus(item.exp_date);
            if (info.status === 'safe') safe++;
            else if (info.status === 'warning') warning++;
            else danger++;
        });

        const total = inventoryData.length || 1;
        const stats = [
            { label: 'Safe', count: safe, color: 'var(--safe)', pct: (safe / total) * 100 },
            { label: 'Warning', count: warning, color: 'var(--warning)', pct: (warning / total) * 100 },
            { label: 'Expired', count: danger, color: 'var(--danger)', pct: (danger / total) * 100 }
        ];

        statusContainer.innerHTML = stats.map(s => `
        <div class="analytics-row">
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.875rem;">
                <span>${s.label}</span>
                <strong>${s.count} Items (${Math.round(s.pct)}%)</strong>
            </div>
            <div style="height: 8px; background: var(--secondary-color); border-radius: 4px; overflow: hidden;">
                <div style="width: ${s.pct}%; height: 100%; background: ${s.color}; border-radius: 4px; transition: width 1s ease;"></div>
            </div>
        </div>
    `).join('');
    }

    // --- Catalog Functions ---
    function loadCatalog() {
        try {
            const stored = localStorage.getItem(CATALOG_KEY);
            if (stored) {
                catalogData = JSON.parse(stored);
            }
        } catch (e) {
            console.error("Failed to load catalog", e);
            catalogData = [];
        }
        renderCatalog();
        renderCatalog();
    }

    function saveCatalog() {
        try {
            localStorage.setItem(CATALOG_KEY, JSON.stringify(catalogData));
        } catch (e) {
            console.error("Failed to save catalog", e);
        }
    }

    function renderCatalog() {
        const tbody = document.getElementById('catalog-tbody');
        if (!tbody) return;

        tbody.innerHTML = '';
        if (catalogData.length === 0) {
            tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; padding: 2rem; color: var(--text-muted);">No templates yet. Add one to see suggestions!</td></tr>`;
            return;
        }

        catalogData.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
            <td><strong>${item.name}</strong></td>
            <td>${item.manufacturer}</td>
            <td><button class="btn-delete" onclick="deleteCatalogItem('${item.id}')" title="Delete"><i class="ph ph-trash"></i></button></td>
        `;
            tbody.appendChild(tr);
        });
    }

    window.deleteCatalogItem = function (id) {
        if (!confirm('Delete this catalog item?')) return;
        catalogData = catalogData.filter(item => item.id !== id);
        saveCatalog();
        renderCatalog();
        createToast({ title: 'Deleted', msg: 'Item removed from catalog.', type: 'info', icon: 'ph-info', color: 'var(--text-muted)' });
    };

    // --- Import/Export Logic ---

    function exportToCSV(data, filename, headers) {
        if (!data || !data.length) {
            createToast({ title: 'No Data', msg: 'There is no data to export.', type: 'warning', icon: 'ph-warning', color: 'var(--warning)' });
            return;
        }

        const csvRows = [];
        csvRows.push(headers.join(','));

        for (const row of data) {
            const values = headers.map(header => {
                const val = row[header.toLowerCase().replace(/ /g, '_')] || '';
                const escaped = ('' + val).replace(/"/g, '""');
                return `"${escaped}"`;
            });
            csvRows.push(values.join(','));
        }

        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('hidden', '');
        a.setAttribute('href', url);
        a.setAttribute('download', filename);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    function parseCSV(text) {
        const lines = text.split('\n').filter(line => line.trim() !== '');
        if (lines.length < 2) return [];

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, '').replace(/ /g, '_'));
        const result = [];

        for (let i = 1; i < lines.length; i++) {
            const obj = {};
            const currentLine = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/); // Split by comma but respect quotes

            headers.forEach((header, index) => {
                let val = currentLine[index] ? currentLine[index].trim() : '';
                val = val.replace(/^"|"$/g, '').replace(/""/g, '"');
                obj[header] = val;
            });
            result.push(obj);
        }
        return result;
    }

    function handleExportCatalog() {
        exportToCSV(catalogData, 'shopsafe_catalog.csv', ['Name', 'Manufacturer']);
    }

    function handleImportCatalog(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (e) {
            const text = e.target.result;
            const imported = parseCSV(text);

            if (imported.length > 0) {
                imported.forEach(item => {
                    if (item.name && item.manufacturer) {
                        catalogData.push({
                            id: (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).substring(2),
                            name: item.name,
                            manufacturer: item.manufacturer
                        });
                    }
                });
                saveCatalog();
                renderCatalog();
                createToast({ title: 'Imported', msg: `Successfully imported ${imported.length} templates.`, type: 'success', icon: 'ph-check-circle', color: 'var(--primary-color)' });
            } else {
                createToast({ title: 'Import Failed', msg: 'No valid data found in CSV.', type: 'danger', icon: 'ph-warning-octagon', color: 'var(--danger)' });
            }
            event.target.value = ''; // Reset input
        };
        reader.readAsText(file);
    }

    function handleExportInventory() {
        exportToCSV(inventoryData, 'shopsafe_inventory.csv', ['Name', 'Manufacturer', 'Category', 'Quantity', 'Batch Number', 'MFG Date', 'Exp Date']);
    }

    function handleImportInventory(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (e) {
            const text = e.target.result;
            const imported = parseCSV(text);

            if (imported.length > 0) {
                imported.forEach(item => {
                    if (item.name && item.exp_date) {
                        inventoryData.push({
                            id: (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).substring(2),
                            name: item.name,
                            manufacturer: item.manufacturer || '',
                            category: item.category || 'Other',
                            quantity: parseInt(item.quantity) || 1,
                            batch_number: item.batch_number || '',
                            mfg_date: item.mfg_date || null,
                            exp_date: item.exp_date,
                            created_at: new Date().toISOString()
                        });
                    }
                });
                saveInventory();
                renderInventory();
                updateStats();
                generateAiExpiryWarnings();
                renderAnalytics();
                createToast({ title: 'Imported', msg: `Successfully imported ${imported.length} items.`, type: 'success', icon: 'ph-check-circle', color: 'var(--safe)' });
            } else {
                createToast({ title: 'Import Failed', msg: 'No valid data found in CSV.', type: 'danger', icon: 'ph-warning-octagon', color: 'var(--danger)' });
            }
            event.target.value = ''; // Reset input
        };
        reader.readAsText(file);
    }

    function handleClearInventory() {
        const confirmClearInvModal = document.getElementById('confirm-clear-inv-modal');
        confirmClearInvModal.style.display = 'flex';
        setTimeout(() => confirmClearInvModal.classList.add('active'), 10);

        const btnCancel = document.getElementById('btn-cancel-inv-clear');
        const btnConfirm = document.getElementById('btn-confirm-inv-clear');

        const closeInvModal = () => {
            confirmClearInvModal.classList.remove('active');
            setTimeout(() => confirmClearInvModal.style.display = 'none', 300);
        };

        btnCancel.onclick = closeInvModal;

        btnConfirm.onclick = async () => {
            closeInvModal();
            try {
                const response = await fetch(`${API_URL}/clear`, { method: 'DELETE' });
                if (!response.ok) throw new Error("Failed to clear backend database");

                inventoryData = [];
                saveInventory();
                renderInventory();
                updateStats();
                generateAiExpiryWarnings();
                renderAnalytics();
                createToast({ title: 'Cleared', msg: 'All inventory data deleted successfully.', type: 'success', icon: 'ph-trash', color: 'var(--safe)' });
            } catch (e) {
                console.error("Failed to delete all items", e);
                // Fallback for local storage only if backend fails
                inventoryData = [];
                saveInventory();
                renderInventory();
                updateStats();
                generateAiExpiryWarnings();
                renderAnalytics();
                createToast({ title: 'Local Data Cleared', msg: 'Local inventory data deleted, but backend may be offline.', type: 'warning', icon: 'ph-warning', color: 'var(--warning)' });
            }
        };
    }

    // --- Search & Related Products Logic ---
    function setupGlobalSearch() {
        const searchInput = document.querySelector('.search-bar input');
        const suggestionBox = document.getElementById('global-search-suggestions');
        if (!searchInput || !suggestionBox) return;

        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            currentSearchQuery = query;

            if (!query) {
                suggestionBox.innerHTML = '';
                suggestionBox.classList.remove('active');
                renderInventory(); // Show all in inventory
                return;
            }

            const matches = inventoryData.filter(item =>
                item.name.toLowerCase().includes(query) ||
                (item.manufacturer && item.manufacturer.toLowerCase().includes(query))
            );

            if (matches.length > 0) {
                suggestionBox.innerHTML = matches.map(item => `
                    <div class="suggestion-item" onclick="switchTab('inventory'); openProductDetail('${item.id}'); document.getElementById('global-search-suggestions').classList.remove('active');">
                        <strong>${item.name}</strong>
                        <div style="display: flex; justify-content: space-between; width: 100%; color: var(--text-muted); font-size: 0.75rem; margin-top: 2px;">
                            <span>${item.manufacturer || 'Unknown Brand'}</span>
                            <span class="status-text ${getExpiryStatus(item.exp_date).status}">Exp: ${getExpiryStatus(item.exp_date).label}</span>
                        </div>
                    </div>
                `).join('');
                suggestionBox.classList.add('active');
            } else {
                suggestionBox.innerHTML = `<div style="padding: 1rem; text-align: center; color: var(--text-muted); font-size: 0.875rem;">No products found for "${query}"</div>`;
                suggestionBox.classList.add('active');
            }

            renderInventory(); // Still filter the table if viewing inventory
        });

        // Close on click outside
        document.addEventListener('click', (e) => {
            if (!searchInput.contains(e.target) && !suggestionBox.contains(e.target)) {
                suggestionBox.classList.remove('active');
            }
        });
    }

    async function handleGlobalSearch(query) {
        document.getElementById('search-query-display').innerText = query;
        switchTab('search-results');
        const grid = document.getElementById('search-results-grid');
        grid.innerHTML = '<div style="text-align: center; grid-column: 1/-1; padding: 2rem;">Searching...</div>';

        try {
            const response = await fetch(`${API_URL}/search?q=${encodeURIComponent(query)}`);
            const products = await response.json();
            renderProductCards(products, grid);
        } catch (e) {
            console.error("Search failed", e);
            grid.innerHTML = '<div style="text-align: center; grid-column: 1/-1; padding: 2rem; color: var(--danger);">Search failed. Backend may be offline.</div>';
        }
    }

    function renderProductCards(products, container) {
        if (!products.length) {
            container.innerHTML = '<div style="text-align: center; grid-column: 1/-1; padding: 2rem; color: var(--text-muted);">No products found.</div>';
            return;
        }

        container.innerHTML = products.map(p => `
            <div class="product-card" onclick="openProductDetail('${p._id}')">
                <span class="category-tag">${p.category}</span>
                <h4>${p.name}</h4>
                <p class="brand">${p.company || 'Unknown Brand'}</p>
                <div class="meta">
                    <span>Exp: ${new Date(p.expiryDate).toLocaleDateString()}</span>
                    <i class="ph ph-arrow-right"></i>
                </div>
            </div>
        `).join('');
    }

    window.openProductDetail = async function (id) {
        const modal = document.getElementById('product-detail-modal');
        currentDetailId = id;
        modal.style.display = 'flex';

        try {
            const response = await fetch(`${API_URL}`);
            const all = await response.json();
            const p = all.find(item => item._id === id);

            if (!p) return;

            document.getElementById('detail-product-name').innerText = p.name;
            document.getElementById('detail-product-brand').innerText = p.company || 'Unknown Brand';
            document.getElementById('detail-category').innerText = p.category;
            document.getElementById('detail-expiry').innerText = new Date(p.expiryDate).toLocaleDateString();
            document.getElementById('detail-batch').innerText = p.batchNumber || p.batch_number || '-';
            document.getElementById('detail-mfg').innerText = p.manufactureDate ? new Date(p.manufactureDate).toLocaleDateString() : '-';

            // Related Products logic
            fetchRelatedProducts(p.category, p._id);

        } catch (e) {
            console.error("Failed to load details", e);
        }
    };

    async function fetchRelatedProducts(category, excludeId) {
        const grid = document.getElementById('related-products-grid');
        grid.innerHTML = '<div style="font-size: 0.8rem; padding: 1rem;">Loading related...</div>';

        try {
            const response = await fetch(`${API_URL}/search?q=${encodeURIComponent(category)}`);
            const results = await response.json();

            // Filter out current product
            const related = results.filter(p => p._id !== excludeId);

            if (!related.length) {
                grid.innerHTML = '<div style="font-size: 0.8rem; padding: 1rem; color: var(--text-muted);">No similar products found in this category.</div>';
                return;
            }

            grid.innerHTML = related.map(p => `
                <div class="product-card" onclick="openProductDetail('${p._id}')">
                    <span class="category-tag">${p.category}</span>
                    <h4 style="font-size: 0.9rem;">${p.name}</h4>
                    <p class="brand" style="font-size: 0.75rem; margin-bottom: 0.5rem;">${p.company || 'Unknown'}</p>
                    <div class="meta" style="padding-top: 0.5rem; font-size: 0.7rem;">
                        <span>Exp: ${new Date(p.expiryDate).toLocaleDateString()}</span>
                    </div>
                </div>
            `).join('');

        } catch (e) {
            grid.innerHTML = '';
        }
    }
    // --- Settings UI Logic ---
    function loadSettings() {
        const userEmailInput = document.getElementById('setting-user-email');

        if (userEmailInput) {
            userEmailInput.value = localStorage.getItem('shopsafe_user_email') || '';
        }
    }

    const btnSaveSettings = document.getElementById('btn-save-settings');
    if (btnSaveSettings) {
        btnSaveSettings.addEventListener('click', () => {
            const userEmail = document.getElementById('setting-user-email') ? document.getElementById('setting-user-email').value.trim() : '';

            localStorage.setItem('shopsafe_user_email', userEmail);

            createToast({
                title: 'Settings Saved',
                msg: 'Your email preferences have been securely saved.',
                type: 'success',
                icon: 'ph-check-circle',
                color: 'var(--safe)'
            });
        });
    }

    // Initialize the Settings view data on load
    loadSettings();

    // Send Alert Email button
    const btnSendAlert = document.getElementById('btn-send-alert');
    if (btnSendAlert) {
        btnSendAlert.addEventListener('click', async () => {
            const toEmail = localStorage.getItem('shopsafe_user_email') || '';

            if (!toEmail) {
                createToast({ title: 'Missing Email', msg: 'Please save a User Email in Settings first.', type: 'warning', icon: 'ph-warning', color: 'var(--warning)' });
                return;
            }

            const alertItems = inventoryData.filter(item => {
                const s = getExpiryStatus(item.exp_date).status;
                return s === 'warning' || s === 'danger';
            });

            if (alertItems.length === 0) {
                createToast({ title: 'Nothing to Report', msg: 'Your inventory looks healthy – no items expiring soon.', type: 'success', icon: 'ph-check-circle', color: 'var(--safe)' });
                return;
            }

            btnSendAlert.disabled = true;
            btnSendAlert.innerHTML = '<i class="ph ph-circle-notch"></i> Sending...';

            try {
                const response = await fetch(`${API_URL}/send-alert`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ toEmail, items: alertItems })
                });
                const data = await response.json();

                if (response.ok) {
                    createToast({ title: 'Email Sent!', msg: `Alert email sent to ${toEmail}.`, type: 'success', icon: 'ph-paper-plane-tilt', color: 'var(--safe)' });
                } else {
                    createToast({ title: 'Send Failed', msg: data.message || 'Could not send the alert email.', type: 'error', icon: 'ph-warning-circle', color: 'var(--danger)' });
                }
            } catch (e) {
                createToast({ title: 'Send Failed', msg: 'Backend unreachable. Make sure the server is running.', type: 'error', icon: 'ph-warning-circle', color: 'var(--danger)' });
            } finally {
                btnSendAlert.disabled = false;
                btnSendAlert.innerHTML = '<i class="ph ph-envelope-open"></i> Send Alert Email Now';
            }
        });
    }

    // --- Push Notification Logic ---


    const NOTIF_API = 'http://127.0.0.1:5000/api/notifications';
    let swRegistration = null;
    let pushEnabled = false;

    // Convert a base64url string to a Uint8Array (required for applicationServerKey)
    function urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = atob(base64);
        return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
    }

    function updatePushUI(state) {
        const dot = document.getElementById('push-status-dot');
        const text = document.getElementById('push-status-text');
        const enableBtn = document.getElementById('btn-enable-push');
        const testBtn = document.getElementById('btn-test-push');
        if (!dot || !text || !enableBtn || !testBtn) return;

        switch (state) {
            case 'enabled':
                dot.style.background = 'var(--safe)';
                text.style.color = 'var(--safe)';
                text.innerText = '✅ Push notifications are enabled on this device';
                enableBtn.innerHTML = '<i class="ph ph-bell-slash"></i> Disable Push Notifications';
                enableBtn.style.background = 'var(--danger)';
                enableBtn.style.borderColor = 'var(--danger)';
                testBtn.disabled = false;
                pushEnabled = true;
                break;
            case 'disabled':
                dot.style.background = 'var(--text-muted)';
                text.style.color = 'var(--text-muted)';
                text.innerText = '🔕 Push notifications are not enabled on this device';
                enableBtn.innerHTML = '<i class="ph ph-bell-ringing"></i> Enable Push Notifications';
                enableBtn.style.background = '';
                enableBtn.style.borderColor = '';
                testBtn.disabled = true;
                pushEnabled = false;
                break;
            case 'denied':
                dot.style.background = 'var(--danger)';
                text.style.color = 'var(--danger)';
                text.innerText = '🚫 Notification permission was denied. Please allow it in browser settings.';
                enableBtn.innerHTML = '<i class="ph ph-bell-slash"></i> Permission Denied';
                enableBtn.disabled = true;
                testBtn.disabled = true;
                pushEnabled = false;
                break;
            case 'unsupported':
                dot.style.background = 'var(--warning)';
                text.style.color = 'var(--warning)';
                text.innerText = '⚠️ Push notifications are not supported in this browser or environment.';
                enableBtn.disabled = true;
                testBtn.disabled = true;
                break;
            case 'loading':
                dot.style.background = 'var(--primary-color)';
                text.style.color = 'var(--text-muted)';
                text.innerText = 'Working...';
                break;
        }
    }

    async function initPushNotifications() {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            updatePushUI('unsupported');
            return;
        }

        try {
            swRegistration = await navigator.serviceWorker.register('/sw.js');
            console.log('[Push] Service Worker registered:', swRegistration.scope);

            const existingSub = await swRegistration.pushManager.getSubscription();
            if (existingSub) {
                updatePushUI('enabled');
            } else if (Notification.permission === 'denied') {
                updatePushUI('denied');
            } else {
                updatePushUI('disabled');
            }
        } catch (err) {
            console.warn('[Push] SW registration failed:', err.message);
            updatePushUI('unsupported');
        }
    }

    async function enablePushNotifications() {
        if (!swRegistration) return;
        updatePushUI('loading');

        try {
            const existingSub = await swRegistration.pushManager.getSubscription();

            if (existingSub && pushEnabled) {
                // Disable: unsubscribe
                await existingSub.unsubscribe();
                await fetch(`${NOTIF_API}/unsubscribe`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ endpoint: existingSub.endpoint })
                });
                updatePushUI('disabled');
                createToast({ title: 'Notifications Disabled', msg: 'You will no longer receive push alerts.', type: 'info', icon: 'ph-bell-slash', color: 'var(--text-muted)' });
                return;
            }

            // Enable: request permission + subscribe
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                updatePushUI('denied');
                return;
            }

            // Get VAPID public key from backend
            const keyRes = await fetch(`${NOTIF_API}/vapid-public-key`);
            const { publicKey } = await keyRes.json();

            const subscription = await swRegistration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(publicKey)
            });

            // Save subscription to backend
            await fetch(`${NOTIF_API}/subscribe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(subscription)
            });

            updatePushUI('enabled');
            createToast({ title: '🔔 Notifications Enabled!', msg: 'You will receive OS push alerts for expiring products.', type: 'success', icon: 'ph-bell-ringing', color: 'var(--safe)' });

        } catch (err) {
            console.error('[Push] Error:', err);
            createToast({ title: 'Push Setup Failed', msg: err.message, type: 'error', icon: 'ph-warning-circle', color: 'var(--danger)' });
            updatePushUI('disabled');
        }
    }

    // Wire up buttons
    const btnEnablePush = document.getElementById('btn-enable-push');
    const btnTestPush = document.getElementById('btn-test-push');

    if (btnEnablePush) {
        btnEnablePush.addEventListener('click', enablePushNotifications);
    }

    if (btnTestPush) {
        btnTestPush.addEventListener('click', async () => {
            btnTestPush.disabled = true;
            btnTestPush.innerHTML = '<i class="ph ph-circle-notch"></i> Sending...';
            try {
                const res = await fetch(`${NOTIF_API}/test`, { method: 'POST' });
                const data = await res.json();
                createToast({ title: 'Test Push Sent!', msg: data.message || 'Check your OS notification tray.', type: 'success', icon: 'ph-paper-plane-tilt', color: 'var(--safe)' });
            } catch (e) {
                createToast({ title: 'Test Push Failed', msg: 'Backend unreachable. Ensure the server is running.', type: 'error', icon: 'ph-warning-circle', color: 'var(--danger)' });
            } finally {
                btnTestPush.disabled = false;
                btnTestPush.innerHTML = '<i class="ph ph-paper-plane-tilt"></i> Send Test Push Now';
            }
        });
    }

    // Initialize push on page load
    initPushNotifications();

});

