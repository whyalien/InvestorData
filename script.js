// Data storage
        let users = [
            { 
                id: 1,
                username: 'admin', 
                password: 'admin321', 
                role: 'admin', 
                projects: [] 
            }
        ];
        let projects = ['AGHK KPP', 'SNGI', 'VIKSA', 'AMUR RHI'];
        let invoices = [];
        let payments = [];
        let selectedMonth = 'all';
        let selectedProject = 'all';
        let paymentChart = null;
        let projectComparisonChart = null;
        let currentUser = null;

        // Format currency
        function formatCurrency(amount) {
            if (amount === undefined || amount === null || isNaN(amount)) {
                return '0.00';
            }
            return amount.toLocaleString('ru-RU', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
        }

        // Format date
        function formatDate(dateString) {
            if (!dateString) return '';
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return '';
            return date.toLocaleDateString('en-US');
        }
        
        // Show notification
        function showNotification(message, type) {
            const notification = document.getElementById('notification');
            notification.textContent = message;
            notification.className = `notification ${type} show`;
            
            setTimeout(() => {
                notification.className = 'notification';
            }, 3000);
        }

        // Initialize application
        function initApp() {
            loadData();
            renderProjectsFilter();
            updateProjectSelect();
            renderInvoiceTable();
            updateProjectDetails();
            updateMonthlyReport();
            initCharts();
            attachEventListeners();
            updatePaymentInvoiceDropdown();
            document.getElementById('current-user').textContent = currentUser.username;
        }

        // Load data from localStorage
        function loadData() {
            const savedUsers = localStorage.getItem('users');
            const savedProjects = localStorage.getItem('projects');
            const savedInvoices = localStorage.getItem('invoices');
            const savedPayments = localStorage.getItem('payments');
            
            if (savedUsers) users = JSON.parse(savedUsers);
            if (savedProjects) projects = JSON.parse(savedProjects);
            if (savedInvoices) invoices = JSON.parse(savedInvoices);
            if (savedPayments) payments = JSON.parse(savedPayments);
            
            populateMonthFilter();
        }

        // Save data to localStorage
        function saveData() {
            localStorage.setItem('users', JSON.stringify(users));
            localStorage.setItem('projects', JSON.stringify(projects));
            localStorage.setItem('invoices', JSON.stringify(invoices));
            localStorage.setItem('payments', JSON.stringify(payments));
        }

        // Populate month filter
        function populateMonthFilter() {
            const monthSelect = document.getElementById('month-select');
            monthSelect.innerHTML = '<option value="all">All Months</option>';
            
            const months = [...new Set(invoices.map(i => i.month))].filter(m => m).sort().reverse();
            
            months.forEach(month => {
                const date = new Date(month);
                if (!isNaN(date)) {
                    const monthName = date.toLocaleDateString('en-US', { 
                        month: 'long', 
                        year: 'numeric' 
                    });
                    monthSelect.innerHTML += `<option value="${month}">${monthName}</option>`;
                }
            });
            
            monthSelect.value = selectedMonth;
        }

        // Render projects filter
        function renderProjectsFilter() {
            let html = `
                <div class="tab ${selectedProject === 'all' ? 'active' : ''}" data-project="all">All Projects</div>
            `;
            
            // Only show projects the user has access to
            const userProjects = currentUser.role === 'admin' ? 
                projects : 
                (currentUser.projects || []);
            
            userProjects.forEach(project => {
                const count = invoices.filter(i => i.project === project).length;
                html += `
                    <div class="tab ${selectedProject === project ? 'active' : ''}" data-project="${project}">
                        ${project} <span class="project-stats">${count}</span>
                    </div>
                `;
            });
            
            if (currentUser.role === 'admin') {
                html += `
                    <div class="tab add-project" id="add-project-btn">
                        <i class="fas fa-plus"></i> Add Project
                    </div>
                `;
            }
            
            document.getElementById('projects-filter').innerHTML = html;
        }

        // Update project select in form
        function updateProjectSelect() {
            const select = document.getElementById('project');
            let options = '<option value="">Select Project</option>';
            
            // Only show projects the user has access to
            const userProjects = currentUser.role === 'admin' ? 
                projects : 
                (currentUser.projects || []);
            
            userProjects.forEach(project => {
                options += `<option value="${project}">${project}</option>`;
            });
            
            select.innerHTML = options;
        }
        
        // Update payment invoice dropdown
        function updatePaymentInvoiceDropdown() {
            const select = document.getElementById('payment-invoice');
            select.innerHTML = '<option value="">Select Invoice</option>';
            
            // Filter invoices that have a balance due
            invoices.forEach(invoice => {
                // Only show projects the user has access to
                if (currentUser.role !== 'admin' && 
                    (!currentUser.projects || !currentUser.projects.includes(invoice.project))) {
                    return;
                }
                
                const netAmount = invoice.amount - (invoice.retention || 0) - (invoice.advanceDeduction || 0);
                const invoicePayments = payments.filter(p => p.invoiceId === invoice.id);
                const received = invoicePayments.reduce((sum, p) => sum + p.amount, 0);
                const due = netAmount - received;
                
                if (due > 0) {
                    const option = document.createElement('option');
                    option.value = invoice.id;
                    option.textContent = `${invoice.invoiceNumber} (Due: ${formatCurrency(due)} ₽)`;
                    select.appendChild(option);
                }
            });
        }

        // Render invoice table
        function renderInvoiceTable() {
            let filteredInvoices = invoices;
            
            // Filter by project
            if (selectedProject !== 'all') {
                filteredInvoices = filteredInvoices.filter(i => i.project === selectedProject);
            }
            
            // Filter by month
            if (selectedMonth !== 'all') {
                filteredInvoices = filteredInvoices.filter(i => i.month === selectedMonth);
            }
            
            // Filter by user permissions
            if (currentUser.role !== 'admin') {
                filteredInvoices = filteredInvoices.filter(i => 
                    currentUser.projects && currentUser.projects.includes(i.project));
            }
            
            const invoiceBody = document.getElementById('invoice-body');
            
            if (filteredInvoices.length === 0) {
                invoiceBody.innerHTML = `
                    <tr>
                        <td colspan="13" class="empty-state">
                            <i class="fas fa-file-invoice"></i>
                            <h3>No invoice data</h3>
                            <p>Add invoices to start tracking payments</p>
                        </td>
                    </tr>
                `;
                return;
            }
            
            let tableHTML = '';
            
            filteredInvoices.forEach(invoice => {
                const netAmount = invoice.amount - (invoice.retention || 0) - (invoice.advanceDeduction || 0);
                const invoicePayments = payments.filter(p => p.invoiceId === invoice.id);
                const received = invoicePayments.reduce((sum, p) => sum + p.amount, 0);
                const due = netAmount - received;
                
                let statusClass = 'pending';
                let statusText = 'Pending';
                
                if (due <= 0) {
                    statusClass = 'paid';
                    statusText = 'Paid';
                } else if (received > 0) {
                    statusClass = 'partial';
                    statusText = 'Partial';
                }
                
                // Format date for display
                let monthDisplay = '';
                if (invoice.month) {
                    const monthDate = new Date(invoice.month);
                    if (!isNaN(monthDate)) {
                        monthDisplay = monthDate.toLocaleDateString('en-US', { 
                            month: 'short', 
                            year: 'numeric' 
                        });
                    }
                }
                
                // Get invoice type display - updated to new names
                let typeDisplay = '';
                let typeClass = '';
                switch(invoice.type) {
                    case 'service':
                        typeDisplay = 'Revenue Invoice';
                        typeClass = 'service-type';
                        break;
                    case 'advance':
                        typeDisplay = 'Advance Invoice';
                        typeClass = 'advance-type';
                        break;
                    case 'retention':
                        typeDisplay = 'Retention Invoice';
                        typeClass = 'retention-type';
                        break;
                }
                
                tableHTML += `
                    <tr>
                        <td>${invoice.invoiceNumber}</td>
                        <td>
                            ${typeDisplay}
                            <div class="invoice-type-badge ${typeClass}">${typeDisplay}</div>
                        </td>
                        <td>${invoice.project}</td>
                        <td>${invoice.agreement}</td>
                        <td>${monthDisplay}</td>
                        <td>${formatCurrency(invoice.amount)}</td>
                        <td>${formatCurrency(invoice.retention)}</td>
                        <td>${formatCurrency(invoice.advanceDeduction)}</td>
                        <td>${formatCurrency(netAmount)}</td>
                        <td>${formatCurrency(received)}</td>
                        <td>${formatCurrency(due)}</td>
                        <td><span class="status ${statusClass}">${statusText}</span></td>
                        <td>
                            <button class="action-btn edit-invoice" data-id="${invoice.id}">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="action-btn delete-invoice" data-id="${invoice.id}">
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    </tr>
                `;
            });
            
            invoiceBody.innerHTML = tableHTML;
        }

        // Update project details
        function updateProjectDetails() {
            if (selectedProject === 'all') {
                document.getElementById('project-details').innerHTML = '';
                return;
            }
            
            // Calculate project financials
            const projectInvoices = invoices.filter(i => i.project === selectedProject);
            
            // Total service invoices
            const serviceInvoices = projectInvoices.filter(i => i.type === 'service');
            const totalServiceAmount = serviceInvoices.reduce((sum, i) => sum + (i.amount || 0), 0);
            
            // Total advance invoices
            const advanceInvoices = projectInvoices.filter(i => i.type === 'advance');
            const totalAdvancePaid = advanceInvoices.reduce((sum, i) => sum + (i.amount || 0), 0);
            
            // Total retention invoices
            const retentionInvoices = projectInvoices.filter(i => i.type === 'retention');
            const totalRetentionPaid = retentionInvoices.reduce((sum, i) => sum + (i.amount || 0), 0);
            
            // Total retention deducted
            const totalRetentionDeducted = serviceInvoices.reduce((sum, i) => sum + (i.retention || 0), 0);
            
            // Total advance deducted
            const totalAdvanceDeducted = serviceInvoices.reduce((sum, i) => sum + (i.advanceDeduction || 0), 0);
            
            // Calculate balances
            const advanceBalance = totalAdvancePaid - totalAdvanceDeducted;
            const retentionHeld = totalRetentionDeducted - totalRetentionPaid;
            
            // Calculate pending payments
            let pendingPayments = 0;
            projectInvoices.forEach(invoice => {
                const netAmount = invoice.amount - (invoice.retention || 0) - (invoice.advanceDeduction || 0);
                const received = payments.filter(p => p.invoiceId === invoice.id).reduce((sum, p) => sum + p.amount, 0);
                pendingPayments += Math.max(0, netAmount - received);
            });
            
            // Create HTML for project details
            let html = `
                <div class="project-detail-card">
                    <h3>${selectedProject} - Financial Summary</h3>
                    <div class="detail-row">
                        <span class="detail-label">Total Service Amount:</span>
                        <span class="detail-value">${formatCurrency(totalServiceAmount)} ₽</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Total Advance Paid:</span>
                        <span class="detail-value">${formatCurrency(totalAdvancePaid)} ₽</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Total Advance Deducted:</span>
                        <span class="detail-value">${formatCurrency(totalAdvanceDeducted)} ₽</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Advance Balance:</span>
                        <span class="detail-value ${advanceBalance >= 0 ? 'positive' : 'negative'}">${formatCurrency(advanceBalance)} ₽</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Pending Payments:</span>
                        <span class="detail-value">${formatCurrency(pendingPayments)} ₽</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${Math.min(100, (totalAdvanceDeducted / totalAdvancePaid) * 100 || 0)}%"></div>
                    </div>
                </div>
                
                <div class="project-detail-card">
                    <h3>Retention Details</h3>
                    <div class="detail-row">
                        <span class="detail-label">Total Retention Deducted:</span>
                        <span class="detail-value">${formatCurrency(totalRetentionDeducted)} ₽</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Total Retention Paid:</span>
                        <span class="detail-value">${formatCurrency(totalRetentionPaid)} ₽</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Retention Held:</span>
                        <span class="detail-value">${formatCurrency(retentionHeld)} ₽</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${Math.min(100, (totalRetentionPaid / totalRetentionDeducted) * 100 || 0)}%"></div>
                    </div>
                </div>
            `;
            
            document.getElementById('project-details').innerHTML = html;
        }

        // Update monthly report
        function updateMonthlyReport() {
            const now = new Date();
            const currentMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
            const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const lastMonth = lastMonthDate.getFullYear() + '-' + String(lastMonthDate.getMonth() + 1).padStart(2, '0');
            
            // Get invoices for current month
            const currentMonthInvoices = invoices.filter(i => i.month === currentMonth);
            const currentMonthTotal = currentMonthInvoices.reduce((sum, i) => sum + (i.amount || 0), 0);
            
            // Get invoices for last month
            const lastMonthInvoices = invoices.filter(i => i.month === lastMonth);
            const lastMonthTotal = lastMonthInvoices.reduce((sum, i) => sum + (i.amount || 0), 0);
            
            // Calculate percentage change
            const invoiceChangePercent = lastMonthTotal > 0 ? 
                Math.round(((currentMonthTotal - lastMonthTotal) / lastMonthTotal) * 100) : 0;
            
            // Get payments for current month
            const currentMonthPayments = payments.filter(p => {
                const paymentDate = new Date(p.date);
                const paymentMonth = paymentDate.getFullYear() + '-' + String(paymentDate.getMonth() + 1).padStart(2, '0');
                return paymentMonth === currentMonth;
            });
            const currentMonthPaymentsTotal = currentMonthPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
            
            // Get payments for last month
            const lastMonthPayments = payments.filter(p => {
                const paymentDate = new Date(p.date);
                const paymentMonth = paymentDate.getFullYear() + '-' + String(paymentDate.getMonth() + 1).padStart(2, '0');
                return paymentMonth === lastMonth;
            });
            const lastMonthPaymentsTotal = lastMonthPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
            
            // Calculate percentage change
            const paymentChangePercent = lastMonthPaymentsTotal > 0 ? 
                Math.round(((currentMonthPaymentsTotal - lastMonthPaymentsTotal) / lastMonthPaymentsTotal) * 100) : 0;
            
            // Calculate pending payments
            const pendingPayments = invoices.reduce((sum, i) => {
                const netAmount = (i.amount || 0) - (i.retention || 0) - (i.advanceDeduction || 0);
                const received = payments
                    .filter(p => p.invoiceId === i.id)
                    .reduce((s, p) => s + (p.amount || 0), 0);
                return sum + Math.max(0, netAmount - received);
            }, 0);
            
            // Calculate average payment time
            let totalDays = 0;
            let count = 0;
            
            invoices.forEach(invoice => {
                const payment = payments.find(p => p.invoiceId === invoice.id);
                if (payment && invoice.dueDate) {
                    const dueDate = new Date(invoice.dueDate);
                    const paymentDate = new Date(payment.date);
                    if (!isNaN(dueDate) && !isNaN(paymentDate)) {
                        const diffTime = Math.abs(paymentDate - dueDate);
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        totalDays += diffDays;
                        count++;
                    }
                }
            });
            
            const avgDays = count > 0 ? Math.round(totalDays / count) : 0;
            
            // Update UI
            document.getElementById('invoices-month-value').textContent = 
                formatCurrency(currentMonthTotal) + ' ₽';
            document.getElementById('invoices-trend').textContent = 
                `${Math.abs(invoiceChangePercent)}%`;
            document.querySelector('#invoices-month-value + .trend i').className = 
                invoiceChangePercent >= 0 ? 'fas fa-arrow-up' : 'fas fa-arrow-down';
            
            document.getElementById('received-month-value').textContent = 
                formatCurrency(currentMonthPaymentsTotal) + ' ₽';
            document.getElementById('received-trend').textContent = 
                `${Math.abs(paymentChangePercent)}%`;
            document.querySelector('#received-month-value + .trend i').className = 
                paymentChangePercent >= 0 ? 'fas fa-arrow-up' : 'fas fa-arrow-down';
            
            document.getElementById('pending-value').textContent = 
                formatCurrency(pendingPayments) + ' ₽';
            
            document.getElementById('avg-time-value').textContent = 
                avgDays + ' days';
            
            // Update charts
            updateCharts();
        }

        // Initialize charts
        function initCharts() {
            const ctx = document.getElementById('paymentChart').getContext('2d');
            paymentChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                    datasets: [{
                        label: 'Invoices',
                        data: [220000, 240000, 227000, 255500, 210000, 235000],
                        backgroundColor: 'rgba(52, 152, 219, 0.7)',
                        borderColor: 'rgba(52, 152, 219, 1)',
                        borderWidth: 1
                    }, {
                        label: 'Payments',
                        data: [180000, 200000, 210000, 225000, 190000, 215000],
                        backgroundColor: 'rgba(40, 167, 69, 0.7)',
                        borderColor: 'rgba(40, 167, 69, 1)',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: function(value) {
                                    return formatCurrency(value) + ' ₽';
                                }
                            }
                        }
                    }
                }
            });
            
            const projectPieCtx = document.getElementById('projectComparisonChart').getContext('2d');
            projectComparisonChart = new Chart(projectPieCtx, {
                type: 'pie',
                data: {
                    labels: projects,
                    datasets: [{
                        data: projects.map(p => {
                            const projectInvoices = invoices.filter(i => i.project === p);
                            return projectInvoices.reduce((sum, i) => sum + (i.amount || 0), 0);
                        }),
                        backgroundColor: [
                            'rgba(52, 152, 219, 0.7)',
                            'rgba(40, 167, 69, 0.7)',
                            'rgba(241, 196, 15, 0.7)',
                            'rgba(231, 76, 60, 0.7)',
                            'rgba(155, 89, 182, 0.7)',
                            'rgba(26, 188, 156, 0.7)'
                        ],
                        borderColor: [
                            'rgba(52, 152, 219, 1)',
                            'rgba(40, 167, 69, 1)',
                            'rgba(241, 196, 15, 1)',
                            'rgba(231, 76, 60, 1)',
                            'rgba(155, 89, 182, 1)',
                            'rgba(26, 188, 156, 1)'
                        ],
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'top',
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return `${context.label}: ${formatCurrency(context.raw)} ₽`;
                                }
                            }
                        }
                    }
                }
            });
        }

        // Update charts with real data
        function updateCharts() {
            const now = new Date();
            const currentMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
            
            // Get project data for current month
            const projectData = {};
            projects.forEach(project => {
                const projectInvoices = invoices.filter(i => 
                    i.project === project && i.month === currentMonth
                );
                projectData[project] = projectInvoices.reduce((sum, i) => sum + (i.amount || 0), 0);
            });
            
            // Update project comparison chart
            if (projectComparisonChart) {
                projectComparisonChart.data.labels = projects;
                projectComparisonChart.data.datasets[0].data = projects.map(p => projectData[p]);
                projectComparisonChart.update();
            }
            
            // Update payment chart with last 6 months data
            const months = [];
            const invoiceData = [];
            const paymentData = [];
            
            // Generate last 6 months labels
            for (let i = 5; i >= 0; i--) {
                const date = new Date();
                date.setMonth(date.getMonth() - i);
                const monthStr = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
                const monthName = date.toLocaleDateString('en-US', { month: 'short' });
                months.push(monthName);
                
                // Calculate invoices for this month
                const monthInvoices = invoices.filter(i => i.month === monthStr);
                const monthInvoiceTotal = monthInvoices.reduce((sum, i) => sum + (i.amount || 0), 0);
                invoiceData.push(monthInvoiceTotal);
                
                // Calculate payments for this month
                const monthPayments = payments.filter(p => {
                    const paymentDate = new Date(p.date);
                    const paymentMonth = paymentDate.getFullYear() + '-' + String(paymentDate.getMonth() + 1).padStart(2, '0');
                    return paymentMonth === monthStr;
                });
                const monthPaymentTotal = monthPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
                paymentData.push(monthPaymentTotal);
            }
            
            if (paymentChart) {
                paymentChart.data.labels = months;
                paymentChart.data.datasets[0].data = invoiceData;
                paymentChart.data.datasets[1].data = paymentData;
                paymentChart.update();
            }
        }

        // Export data to Excel
        function exportToExcel(type) {
            let data = [];
            let filename = '';
            
            if (type === 'invoices' || type === 'both') {
                data = invoices.map(invoice => {
                    return {
                        'Invoice Number': invoice.invoiceNumber,
                        'Project': invoice.project,
                        'Contract': invoice.agreement,
                        'Type': invoice.type,
                        'Month': invoice.month,
                        'Amount (₽)': invoice.amount,
                        'Retention (₽)': invoice.retention || 0,
                        'Advance Deduction (₽)': invoice.advanceDeduction || 0,
                        'Due Date': invoice.dueDate || ''
                    };
                });
                filename = 'Invoices.xlsx';
            }
            
            if (type === 'payments') {
                data = payments.map(payment => {
                    const invoice = invoices.find(i => i.id === payment.invoiceId);
                    return {
                        'Invoice Number': invoice ? invoice.invoiceNumber : 'Unknown',
                        'Payment Date': payment.date,
                        'Amount (₽)': payment.amount,
                        'Payment Method': payment.method || 'Bank Transfer',
                        'Reference': payment.reference || ''
                    };
                });
                filename = 'Payments.xlsx';
            }
            
            if (data.length === 0) {
                showNotification('No data to export', 'error');
                return;
            }
            
            // Create worksheet and workbook
            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Data');
            
            // Export to file
            XLSX.writeFile(wb, filename);
        }

        // Import data from Excel
        function importData(file, type) {
            const reader = new FileReader();
            
            reader.onload = function(e) {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, {type: 'array'});
                    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet);
                    
                    let invoiceCount = 0;
                    let paymentCount = 0;
                    let skippedPayments = 0;
                    
                    if (type === 'invoices' || type === 'both') {
                        jsonData.forEach(item => {
                            // Create invoice object with fixed mapping
                            const newInvoice = {
                                id: Date.now().toString() + Math.random(),
                                invoiceNumber: item['Invoice #'] || item['Invoice Number'] || '',
                                project: item.Project || '',
                                agreement: item.Contract || item['Contract Number'] || '',
                                type: item.Type || 'service',
                                month: item['Month (YYYY-MM)'] || item.Month || '',
                                amount: item['Amount (₽)'] || 0,
                                retention: item['Retention (₽)'] || 0,
                                advanceDeduction: item['Advance Deduction (₽)'] || 0,
                                dueDate: item['Due Date (YYYY-MM-DD)'] || item['Due Date'] || ''
                            };
                            
                            invoices.push(newInvoice);
                            invoiceCount++;
                        });
                    }
                    
                    if (type === 'payments' || type === 'both') {
                        jsonData.forEach(item => {
                            const invoiceNumber = item['Invoice #'] || item['Invoice Number'];
                            const invoice = invoices.find(inv => inv.invoiceNumber === invoiceNumber);
                            
                            if (invoice) {
                                const newPayment = {
                                    id: Date.now().toString() + Math.random(),
                                    invoiceId: invoice.id,
                                    date: item['Payment Date (YYYY-MM-DD)'] || item['Payment Date'],
                                    amount: item['Amount (₽)'],
                                    method: item['Payment Method'] || 'Bank Transfer',
                                    reference: item['Reference'] || ''
                                };
                                
                                payments.push(newPayment);
                                paymentCount++;
                            } else {
                                skippedPayments++;
                            }
                        });
                    }
                    
                    saveData();
                    renderInvoiceTable();
                    updateProjectDetails();
                    updateMonthlyReport();
                    populateMonthFilter();
                    updatePaymentInvoiceDropdown();
                    
                    let msg = `Data imported successfully!`;
                    if (type === 'invoices' || type === 'both') {
                        msg += ` ${invoiceCount} invoices added.`;
                    }
                    if (type === 'payments' || type === 'both') {
                        msg += ` ${paymentCount} payments added.`;
                        if (skippedPayments > 0) {
                            msg += ` ${skippedPayments} payments skipped (invoice not found).`;
                        }
                    }
                    
                    showNotification(msg, 'success');
                } catch (error) {
                    console.error('Import error:', error);
                    showNotification('Error during import: ' + error.message, 'error');
                }
            };
            
            reader.onerror = function() {
                showNotification('Error reading file', 'error');
            };
            
            reader.readAsArrayBuffer(file);
        }

        // Render user list
        function renderUserList() {
            const userList = document.getElementById('user-list');
            userList.innerHTML = '';
            
            users.forEach(user => {
                if (user.username === 'admin') return; // Skip admin user
                
                const projectsList = user.projects && user.projects.length > 0 ? 
                    user.projects.join(', ') : 'All projects';
                
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${user.username}</td>
                    <td>${user.role}</td>
                    <td>${projectsList}</td>
                    <td>
                        <button class="action-btn edit-user" data-id="${user.id}">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn delete-user" data-id="${user.id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                `;
                userList.appendChild(row);
            });
        }

        // Render project access checkboxes
        function renderProjectAccess() {
            const container = document.getElementById('project-access');
            container.innerHTML = '';
            
            projects.forEach(project => {
                const checkbox = document.createElement('div');
                checkbox.className = 'form-check';
                checkbox.innerHTML = `
                    <input type="checkbox" class="form-check-input" id="project-${project}" value="${project}">
                    <label class="form-check-label" for="project-${project}">${project}</label>
                `;
                container.appendChild(checkbox);
            });
        }

        // Attach event listeners
        function attachEventListeners() {
            // Logout functionality
            document.getElementById('logout-btn').addEventListener('click', function(e) {
                e.preventDefault();
                document.getElementById('login-screen').style.display = 'flex';
                document.getElementById('app-container').style.display = 'none';
                currentUser = null;
            });
            
            // Project selection
            document.getElementById('projects-filter').addEventListener('click', function(e) {
                if (e.target.classList.contains('tab')) {
                    if (e.target.classList.contains('add-project')) {
                        document.getElementById('add-project-modal').style.display = 'flex';
                        return;
                    }
                    
                    selectedProject = e.target.dataset.project;
                    
                    // Update active class
                    document.querySelectorAll('.projects-filter .tab').forEach(t => 
                        t.classList.remove('active'));
                    e.target.classList.add('active');
                    
                    renderInvoiceTable();
                    updateProjectDetails();
                }
            });
            
            // Month selection
            document.getElementById('month-select').addEventListener('change', function() {
                selectedMonth = this.value;
                renderInvoiceTable();
            });
            
            // Form submissions
            document.getElementById('invoice-form').addEventListener('submit', function(e) {
                e.preventDefault();
                
                // Gather form data
                const project = document.getElementById('project').value;
                const type = document.getElementById('invoice-type').value;
                const agreement = document.getElementById('agreement').value;
                const invoiceNumber = document.getElementById('invoice-number').value;
                const month = document.getElementById('invoice-month').value;
                const amount = parseFloat(document.getElementById('invoice-amount').value);
                const retention = parseFloat(document.getElementById('retention').value) || 0;
                const advanceDeduction = parseFloat(document.getElementById('advance-deduction').value) || 0;
                const dueDate = document.getElementById('due-date').value;
                const invoiceId = document.getElementById('invoice-id').value;
                
                // Validate inputs
                if (!project || !type || !agreement || !invoiceNumber || !month || !amount || isNaN(amount)) {
                    showNotification('Please fill all required fields', 'error');
                    return;
                }
                
                if (invoiceId) {
                    // Update existing invoice
                    const index = invoices.findIndex(i => i.id === invoiceId);
                    if (index !== -1) {
                        invoices[index] = {
                            ...invoices[index],
                            project,
                            type,
                            agreement,
                            invoiceNumber,
                            month,
                            amount,
                            retention,
                            advanceDeduction,
                            dueDate
                        };
                        showNotification('Invoice updated successfully!', 'success');
                    }
                } else {
                    // Check for duplicate invoice number
                    const invoiceExists = invoices.some(inv => inv.invoiceNumber === invoiceNumber);
                    if (invoiceExists) {
                        showNotification('Invoice number already exists!', 'error');
                        return;
                    }

                    // Create new invoice object
                    const newInvoice = {
                        id: Date.now().toString(), // unique id
                        project,
                        type,
                        agreement,
                        invoiceNumber,
                        month,
                        amount,
                        retention,
                        advanceDeduction,
                        dueDate
                    };

                    // Add to invoices array
                    invoices.push(newInvoice);
                    showNotification('Invoice added successfully!', 'success');
                }

                // Save data
                saveData();

                // Update views
                renderInvoiceTable();
                updateProjectDetails();
                updateMonthlyReport();
                populateMonthFilter();
                updatePaymentInvoiceDropdown();

                // Reset form
                this.reset();
                document.getElementById('invoice-id').value = '';
            });
            
            document.getElementById('payment-form').addEventListener('submit', function(e) {
                e.preventDefault();
                
                const invoiceId = document.getElementById('payment-invoice').value;
                const date = document.getElementById('payment-date').value;
                const amount = parseFloat(document.getElementById('payment-amount').value);
                const paymentId = document.getElementById('payment-id').value;
                
                if (!invoiceId || !date || !amount || isNaN(amount)) {
                    showNotification('Please fill all required fields', 'error');
                    return;
                }

                if (paymentId) {
                    // Update existing payment
                    const index = payments.findIndex(p => p.id === paymentId);
                    if (index !== -1) {
                        payments[index] = {
                            ...payments[index],
                            invoiceId,
                            date,
                            amount
                        };
                        showNotification('Payment updated successfully!', 'success');
                    }
                } else {
                    // Create new payment
                    const newPayment = {
                        id: Date.now().toString(),
                        invoiceId,
                        date,
                        amount
                    };

                    payments.push(newPayment);
                    showNotification('Payment recorded successfully!', 'success');
                }

                saveData();

                // Update views
                renderInvoiceTable();
                updateProjectDetails();
                updateMonthlyReport();
                updatePaymentInvoiceDropdown();

                // Reset form
                this.reset();
                document.getElementById('payment-id').value = '';
            });
            
            document.getElementById('project-form').addEventListener('submit', function(e) {
                e.preventDefault();
                const name = document.getElementById('project-name').value;
                if (name) {
                    if (projects.includes(name)) {
                        showNotification('Project already exists!', 'error');
                        return;
                    }
                    
                    projects.push(name);
                    saveData();
                    renderProjectsFilter();
                    updateProjectSelect();
                    document.getElementById('add-project-modal').style.display = 'none';
                    this.reset();
                    showNotification(`Project "${name}" added successfully!`, 'success');
                }
            });
            
            // Clear forms
            document.getElementById('clear-invoice-form').addEventListener('click', function() {
                document.getElementById('invoice-form').reset();
                document.getElementById('invoice-id').value = '';
            });
            
            document.getElementById('clear-payment-form').addEventListener('click', function() {
                document.getElementById('payment-form').reset();
                document.getElementById('payment-id').value = '';
            });
            
            // Export/Import buttons
            document.getElementById('export-btn').addEventListener('click', function() {
                document.getElementById('import-export-modal').style.display = 'flex';
            });
            
            document.getElementById('import-btn').addEventListener('click', function() {
                document.getElementById('import-export-modal').style.display = 'flex';
                // Switch to import tab
                document.querySelectorAll('#import-export-modal .tab').forEach(tab => tab.classList.remove('active'));
                document.querySelector('#import-export-modal .tab[data-tab="import"]').classList.add('active');
                document.querySelectorAll('#import-export-modal .tab-content').forEach(content => content.classList.remove('active'));
                document.getElementById('import-tab').classList.add('active');
            });
            
            document.getElementById('export-invoices-btn').addEventListener('click', function() {
                exportToExcel('invoices');
            });
            
            document.getElementById('export-payments-btn').addEventListener('click', function() {
                exportToExcel('payments');
            });
            
            document.getElementById('export-all-btn').addEventListener('click', function() {
                exportToExcel('both');
            });
            
            // Import data
            document.getElementById('import-data-btn').addEventListener('click', function() {
                const fileInput = document.getElementById('import-file');
                if (fileInput.files.length === 0) {
                    showNotification('Please select a file to import', 'error');
                    return;
                }
                
                const importType = document.getElementById('import-type').value;
                importData(fileInput.files[0], importType);
            });
            
            // Clear all data
            document.getElementById('clear-data-btn').addEventListener('click', function() {
                if (confirm('Are you sure you want to delete ALL data? This cannot be undone.')) {
                    localStorage.clear();
                    invoices = [];
                    payments = [];
                    projects = ['AGHK KPP', 'SNGI', 'VIKSA', 'AMUR RHI'];
                    saveData();
                    renderInvoiceTable();
                    updateProjectDetails();
                    populateMonthFilter();
                    updatePaymentInvoiceDropdown();
                    showNotification('All data has been cleared!', 'success');
                }
            });
            
            // Close modals
            document.querySelectorAll('.close-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    this.closest('.modal').style.display = 'none';
                });
            }); 
            
            // Modal tab switching
            document.querySelectorAll('#import-export-modal .tab').forEach(tab => {
                tab.addEventListener('click', function() {
                    const tabId = this.dataset.tab;
                    
                    // Update active class
                    this.parentNode.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                    this.classList.add('active');
                    
                    // Show corresponding content
                    document.querySelectorAll('#import-export-modal .tab-content').forEach(content => {
                        content.classList.remove('active');
                    });
                    document.getElementById(`${tabId}-tab`).classList.add('active');
                });
            });
            
            // Delete invoice
            document.addEventListener('click', function(e) {
                if (e.target.classList.contains('delete-invoice')) {
                    const invoiceId = e.target.closest('button').dataset.id;
                    if (confirm('Are you sure you want to delete this invoice?')) {
                        invoices = invoices.filter(inv => inv.id !== invoiceId);
                        // Also remove related payments
                        payments = payments.filter(p => p.invoiceId !== invoiceId);
                        saveData();
                        renderInvoiceTable();
                        updateProjectDetails();
                        updateMonthlyReport();
                        updatePaymentInvoiceDropdown();
                        showNotification('Invoice deleted successfully!', 'success');
                    }
                }
                
                // Edit invoice
                if (e.target.classList.contains('edit-invoice')) {
                    const invoiceId = e.target.closest('button').dataset.id;
                    const invoice = invoices.find(i => i.id === invoiceId);
                    if (invoice) {
                        document.getElementById('invoice-id').value = invoice.id;
                        document.getElementById('project').value = invoice.project;
                        document.getElementById('invoice-type').value = invoice.type;
                        document.getElementById('agreement').value = invoice.agreement;
                        document.getElementById('invoice-number').value = invoice.invoiceNumber;
                        document.getElementById('invoice-month').value = invoice.month;
                        document.getElementById('invoice-amount').value = invoice.amount;
                        document.getElementById('retention').value = invoice.retention || 0;
                        document.getElementById('advance-deduction').value = invoice.advanceDeduction || 0;
                        document.getElementById('due-date').value = invoice.dueDate || '';
                        
                        document.getElementById('save-invoice-btn').innerHTML = '<i class="fas fa-save"></i> Update Invoice';
                    }
                }
            });
            
            // User management
            document.getElementById('user-management-btn').addEventListener('click', function() {
                document.getElementById('user-management-modal').style.display = 'flex';
                renderUserList();
            });
            
            document.getElementById('add-user-btn').addEventListener('click', function() {
                document.getElementById('add-user-form').style.display = 'block';
                renderProjectAccess();
            });
            
            document.getElementById('cancel-user-btn').addEventListener('click', function() {
                document.getElementById('add-user-form').style.display = 'none';
                document.getElementById('user-form').reset();
            });
            
            document.getElementById('user-form').addEventListener('submit', function(e) {
                e.preventDefault();
                
                const username = document.getElementById('new-username').value;
                const password = document.getElementById('new-password').value;
                const role = document.getElementById('user-role').value;
                
                // Get selected projects
                const selectedProjects = [];
                document.querySelectorAll('#project-access input:checked').forEach(checkbox => {
                    selectedProjects.push(checkbox.value);
                });
                
                // Create user object
                const newUser = {
                    id: Date.now(),
                    username,
                    password,
                    role,
                    projects: selectedProjects
                };
                
                users.push(newUser);
                saveData();
                renderUserList();
                
                document.getElementById('add-user-form').style.display = 'none';
                this.reset();
                
                showNotification(`User "${username}" added successfully!`, 'success');
            });
        }

        // Initialize the application when the page loads
        document.addEventListener('DOMContentLoaded', function() {
            // Set up the login button event listener
            document.getElementById('login-btn').addEventListener('click', function() {
                const username = document.getElementById('username').value;
                const password = document.getElementById('password').value;
                const error = document.getElementById('login-error');
                
                const user = users.find(u => u.username === username && u.password === password);
                
                if (user) {
                    currentUser = user;
                    document.getElementById('login-screen').style.display = 'none';
                    document.getElementById('app-container').style.display = 'flex';
                    initApp();
                } else {
                    error.style.display = 'block';
                }
            });

            // Initialize the login screen
            document.getElementById('login-screen').style.display = 'flex';
            document.getElementById('app-container').style.display = 'none';
        });