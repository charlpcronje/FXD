/**
 * FX PDF Composer Module
 * Dynamic PDF generation using FXD's view system for complex documents like bank statements
 */

import { createSnippet } from "./fx-snippets.ts";
import { renderView } from "./fx-view.ts";

/**
 * PDF Document Structure using FXD Views
 * Each component is a reusable snippet that can be dynamically composed
 */
export interface PDFDocumentStructure {
    header: string;           // Path to header view
    clientDetails: string;    // Path to client details view
    promotional?: string;     // Optional promotional content
    transactions: string;     // Path to transactions view
    summary: string;         // Path to summary view
    footer: string;          // Path to footer view
    pageSettings: PageSettings;
}

export interface PageSettings {
    pageHeight: number;      // in mm or pixels
    pageWidth: number;       
    marginTop: number;
    marginBottom: number;
    marginLeft: number;
    marginRight: number;
    headerHeight: number;    // Reserved space for header
    footerHeight: number;    // Reserved space for footer
}

export interface Transaction {
    date: string;
    description: string;
    debit?: number;
    credit?: number;
    balance: number;
    reference?: string;
}

export interface ClientData {
    name: string;
    accountNumber: string;
    address: string[];
    statementPeriod: {
        from: string;
        to: string;
    };
}

/**
 * Smart PDF Composer that uses FXD views for dynamic layout
 */
export class PDFComposer {
    private pageSettings: PageSettings;
    private currentPageHeight: number = 0;
    private pages: string[][] = [[]];
    private currentPage: number = 0;

    constructor(settings: PageSettings) {
        this.pageSettings = settings;
        this.currentPageHeight = settings.marginTop + settings.headerHeight;
    }

    /**
     * Calculate content height (would use actual rendering engine)
     */
    private calculateHeight(content: string): number {
        // Simplified calculation - in production, use puppeteer or similar
        const lines = content.split('\n').length;
        const avgLineHeight = 5; // mm
        return lines * avgLineHeight;
    }

    /**
     * Check if content fits on current page
     */
    private fitsOnPage(contentHeight: number): boolean {
        const availableHeight = this.pageSettings.pageHeight - 
                              this.pageSettings.marginBottom - 
                              this.pageSettings.footerHeight;
        return (this.currentPageHeight + contentHeight) <= availableHeight;
    }

    /**
     * Add content to current page or create new page
     */
    private addContent(viewPath: string, forceNewPage: boolean = false) {
        if (forceNewPage && this.pages[this.currentPage].length > 0) {
            this.newPage();
        }

        const content = renderView(viewPath);
        const height = this.calculateHeight(content);

        if (!this.fitsOnPage(height) && this.pages[this.currentPage].length > 0) {
            this.newPage();
        }

        this.pages[this.currentPage].push(viewPath);
        this.currentPageHeight += height;
    }

    /**
     * Create a new page
     */
    private newPage() {
        this.currentPage++;
        this.pages[this.currentPage] = [];
        this.currentPageHeight = this.pageSettings.marginTop + this.pageSettings.headerHeight;
    }

    /**
     * Compose the full PDF document
     */
    compose(structure: PDFDocumentStructure): string[][] {
        // Reset state
        this.pages = [[]];
        this.currentPage = 0;
        this.currentPageHeight = this.pageSettings.marginTop + this.pageSettings.headerHeight;

        // Add components in order
        this.addContent(structure.header);
        this.addContent(structure.clientDetails);
        
        if (structure.promotional) {
            this.addContent(structure.promotional);
        }

        // Handle transactions with smart pagination
        this.addContent(structure.transactions);
        
        // Summary might need its own page
        const summaryHeight = this.calculateHeight(renderView(structure.summary));
        if (summaryHeight > 50) { // If summary is large, give it a new page
            this.newPage();
        }
        this.addContent(structure.summary);

        // Footer on last page
        this.addContent(structure.footer);

        return this.pages;
    }
}

/**
 * Create bank statement components as FXD snippets
 */
export function createBankStatementComponents() {
    // Create header snippet with template
    createSnippet("statements.components.header", `
<div class="statement-header">
    <img src="{{bank.logo}}" alt="{{bank.name}}" />
    <h1>{{bank.name}} Statement</h1>
    <div class="header-info">
        <span>Statement Period: {{period.from}} - {{period.to}}</span>
        <span>Page {{page.current}} of {{page.total}}</span>
    </div>
</div>
    `, { 
        id: "stmt-header",
        lang: "html",
        file: "components/header.html"
    });

    // Create client details snippet
    createSnippet("statements.components.client", `
<div class="client-details">
    <h2>Account Holder</h2>
    <div class="client-info">
        <strong>{{client.name}}</strong>
        <div>Account: {{client.accountNumber}}</div>
        <div class="address">
            {{#each client.address}}
            <div>{{this}}</div>
            {{/each}}
        </div>
    </div>
</div>
    `, {
        id: "stmt-client",
        lang: "html",
        file: "components/client.html"
    });

    // Create promotional snippet (optional)
    createSnippet("statements.components.promo", `
<div class="promotional-banner">
    <div class="promo-content">
        {{#if promo.image}}
        <img src="{{promo.image}}" alt="{{promo.title}}" />
        {{/if}}
        <h3>{{promo.title}}</h3>
        <p>{{promo.message}}</p>
        {{#if promo.cta}}
        <a href="{{promo.cta.url}}" class="cta-button">{{promo.cta.text}}</a>
        {{/if}}
    </div>
</div>
    `, {
        id: "stmt-promo",
        lang: "html",
        file: "components/promo.html"
    });

    // Create transactions table snippet
    createSnippet("statements.components.transactions", `
<div class="transactions-section">
    <h2>Transaction History</h2>
    <table class="transactions-table">
        <thead>
            <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Reference</th>
                <th>Debit</th>
                <th>Credit</th>
                <th>Balance</th>
            </tr>
        </thead>
        <tbody>
            {{#each transactions}}
            <tr class="transaction-row {{this.type}}">
                <td>{{this.date}}</td>
                <td>{{this.description}}</td>
                <td>{{this.reference}}</td>
                <td class="amount debit">{{this.debit}}</td>
                <td class="amount credit">{{this.credit}}</td>
                <td class="amount balance">{{this.balance}}</td>
            </tr>
            {{/each}}
        </tbody>
    </table>
</div>
    `, {
        id: "stmt-transactions",
        lang: "html",
        file: "components/transactions.html"
    });

    // Create summary snippet
    createSnippet("statements.components.summary", `
<div class="statement-summary">
    <h2>Account Summary</h2>
    <div class="summary-grid">
        <div class="summary-item">
            <span class="label">Opening Balance:</span>
            <span class="value">{{summary.openingBalance}}</span>
        </div>
        <div class="summary-item">
            <span class="label">Total Deposits:</span>
            <span class="value">{{summary.totalDeposits}}</span>
        </div>
        <div class="summary-item">
            <span class="label">Total Withdrawals:</span>
            <span class="value">{{summary.totalWithdrawals}}</span>
        </div>
        <div class="summary-item">
            <span class="label">Service Charges:</span>
            <span class="value">{{summary.serviceCharges}}</span>
        </div>
        <div class="summary-item closing">
            <span class="label">Closing Balance:</span>
            <span class="value">{{summary.closingBalance}}</span>
        </div>
    </div>
</div>
    `, {
        id: "stmt-summary",
        lang: "html",
        file: "components/summary.html"
    });

    // Create footer snippet
    createSnippet("statements.components.footer", `
<div class="statement-footer">
    <div class="footer-content">
        <div class="contact-info">
            <strong>Contact Us:</strong>
            <span>{{bank.phone}} | {{bank.email}} | {{bank.website}}</span>
        </div>
        <div class="legal-text">
            {{footer.legalText}}
        </div>
        <div class="footer-meta">
            <span>Generated: {{generatedDate}}</span>
            <span>Reference: {{referenceNumber}}</span>
        </div>
    </div>
</div>
    `, {
        id: "stmt-footer",
        lang: "html",
        file: "components/footer.html"
    });

    // Create CSS styling snippet
    createSnippet("statements.styles.main", `
/* Bank Statement Styles */
.statement-header {
    border-bottom: 2px solid #003366;
    padding: 20px;
    display: flex;
    justify-content: space-between;
}

.client-details {
    background: #f5f5f5;
    padding: 15px;
    margin: 10px 0;
    border-radius: 5px;
}

.transactions-table {
    width: 100%;
    border-collapse: collapse;
    margin: 20px 0;
}

.transactions-table th {
    background: #003366;
    color: white;
    padding: 8px;
    text-align: left;
}

.transactions-table td {
    padding: 6px 8px;
    border-bottom: 1px solid #ddd;
}

.amount {
    text-align: right;
    font-family: 'Courier New', monospace;
}

.amount.debit {
    color: #cc0000;
}

.amount.credit {
    color: #008800;
}

.statement-summary {
    background: #f9f9f9;
    padding: 20px;
    margin-top: 30px;
    border: 1px solid #ddd;
}

.summary-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
}

.summary-item {
    display: flex;
    justify-content: space-between;
    padding: 5px 0;
}

.summary-item.closing {
    grid-column: span 2;
    font-weight: bold;
    font-size: 1.2em;
    border-top: 2px solid #003366;
    padding-top: 10px;
    margin-top: 10px;
}

.statement-footer {
    margin-top: auto;
    padding: 20px;
    border-top: 1px solid #ccc;
    font-size: 0.9em;
    color: #666;
}

/* Page break controls for PDF */
@media print {
    .page-break {
        page-break-after: always;
    }
    
    .keep-together {
        page-break-inside: avoid;
    }
}
    `, {
        id: "stmt-styles",
        lang: "css",
        file: "styles/statement.css"
    });
}

/**
 * Create dynamic views based on transaction count
 */
export function createDynamicStatementViews(
    client: ClientData,
    transactions: Transaction[],
    options: {
        transactionsPerPage?: number;
        includePromo?: boolean;
        promoContent?: any;
    } = {}
) {
    const transPerPage = options.transactionsPerPage || 30;
    const pageCount = Math.ceil(transactions.length / transPerPage);
    
    // Create views for each page
    const views: string[] = [];
    
    for (let page = 0; page < pageCount; page++) {
        const viewPath = `statements.generated.${client.accountNumber}.page${page + 1}`;
        const isFirstPage = page === 0;
        const isLastPage = page === pageCount - 1;
        
        // Create page-specific group
        const group = $$(viewPath).group([]);
        
        // Always add header
        group.add($$("statements.components.header"));
        
        // First page gets client details and optional promo
        if (isFirstPage) {
            group.add($$("statements.components.client"));
            if (options.includePromo) {
                group.add($$("statements.components.promo"));
            }
        }
        
        // Add transactions for this page
        const startIdx = page * transPerPage;
        const endIdx = Math.min(startIdx + transPerPage, transactions.length);
        const pageTransactions = transactions.slice(startIdx, endIdx);
        
        // Create page-specific transaction snippet
        const transViewPath = `${viewPath}.transactions`;
        createSnippet(transViewPath, 
            renderTransactionTable(pageTransactions), 
            { id: `trans-p${page}`, lang: "html" }
        );
        group.add($$(transViewPath));
        
        // Last page gets summary
        if (isLastPage) {
            group.add($$("statements.components.summary"));
        }
        
        // Always add footer
        group.add($$("statements.components.footer"));
        
        views.push(viewPath);
    }
    
    return views;
}

/**
 * Helper to render transaction table
 */
function renderTransactionTable(transactions: Transaction[]): string {
    const rows = transactions.map(t => `
        <tr>
            <td>${t.date}</td>
            <td>${t.description}</td>
            <td>${t.reference || ''}</td>
            <td class="amount debit">${t.debit ? formatCurrency(t.debit) : ''}</td>
            <td class="amount credit">${t.credit ? formatCurrency(t.credit) : ''}</td>
            <td class="amount balance">${formatCurrency(t.balance)}</td>
        </tr>
    `).join('');
    
    return `
        <table class="transactions-table">
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Reference</th>
                    <th>Debit</th>
                    <th>Credit</th>
                    <th>Balance</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `;
}

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}

/**
 * PDF Generation using Puppeteer or similar
 */
export async function generatePDF(viewPaths: string[], outputPath: string) {
    // This would use Puppeteer or wkhtmltopdf
    // For now, we'll create the HTML structure
    
    const pages = viewPaths.map(viewPath => {
        const content = renderView(viewPath);
        return `
            <div class="page">
                ${content}
            </div>
        `;
    }).join('<div class="page-break"></div>');
    
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                ${renderView("statements.styles.main")}
                
                @page {
                    size: A4;
                    margin: 10mm;
                }
                
                .page {
                    width: 210mm;
                    min-height: 297mm;
                    padding: 10mm;
                    background: white;
                    position: relative;
                }
            </style>
        </head>
        <body>
            ${pages}
        </body>
        </html>
    `;
    
    // In production: await generatePDFFromHTML(html, outputPath);
    return html;
}

/**
 * Example usage for your colleague
 */
export function exampleBankStatementWorkflow() {
    // 1. Initialize components (run once)
    createBankStatementComponents();
    
    // 2. Load client data and transactions
    const client: ClientData = {
        name: "John Doe",
        accountNumber: "1234567890",
        address: ["123 Main St", "New York, NY 10001"],
        statementPeriod: {
            from: "2024-01-01",
            to: "2024-01-31"
        }
    };
    
    // 3. Load transactions (from database/API)
    const transactions: Transaction[] = [
        // ... hundreds of transactions
    ];
    
    // 4. Create dynamic views based on transaction count
    const views = createDynamicStatementViews(client, transactions, {
        transactionsPerPage: 25,
        includePromo: true,
        promoContent: {
            title: "Earn 2% Cashback!",
            message: "Apply for our rewards credit card"
        }
    });
    
    // 5. Generate PDF
    // const pdfPath = await generatePDF(views, `statement_${client.accountNumber}.pdf`);
    
    return views;
}