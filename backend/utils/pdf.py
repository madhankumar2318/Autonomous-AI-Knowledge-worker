# backend/utils/pdf.py
import os
import time
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

def generate_pdf(news, stock, insights, sentiment="neutral", report_type="quick"):
    """
    Generates a beautifully styled project report PDF inside backend/data/reports/.
    """
    ts = int(time.time())
    clean_sentiment = sentiment.strip().lower() if sentiment else "neutral"
    if clean_sentiment not in ["bullish", "bearish", "neutral"]:
        clean_sentiment = "neutral"
    clean_type = report_type.strip().lower() if report_type else "quick"
    filename = f"report_{ts}_{clean_type}_{clean_sentiment}.pdf"
    
    # Path inside data/reports
    reports_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "reports")
    os.makedirs(reports_dir, exist_ok=True)
    file_path = os.path.join(reports_dir, filename)
    
    # Set up document margins
    doc = SimpleDocTemplate(
        file_path,
        pagesize=letter,
        rightMargin=54,
        leftMargin=54,
        topMargin=54,
        bottomMargin=54
    )
    styles = getSampleStyleSheet()
    
    # Custom colors
    primary_color = colors.HexColor("#7c3aed")   # Purple
    secondary_color = colors.HexColor("#1e293b") # Slate Dark
    text_color = colors.HexColor("#334155")      # Slate Gray
    accent_color = colors.HexColor("#0d9488")    # Teal
    
    # Custom Paragraph Styles
    title_style = ParagraphStyle(
        'ReportTitle',
        parent=styles['Title'],
        fontName='Helvetica-Bold',
        fontSize=22,
        leading=26,
        textColor=primary_color,
        alignment=0, # Left-aligned
        spaceAfter=10
    )
    
    meta_style = ParagraphStyle(
        'ReportMeta',
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#64748b"),
        spaceAfter=20
    )
    
    h1_style = ParagraphStyle(
        'SectionHeading',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=17,
        textColor=secondary_color,
        spaceBefore=14,
        spaceAfter=8,
        keepWithNext=True
    )
    
    body_style = ParagraphStyle(
        'ReportBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=13.5,
        textColor=text_color,
        spaceAfter=6
    )
    
    bullet_style = ParagraphStyle(
        'ReportBullet',
        parent=body_style,
        leftIndent=15,
        firstLineIndent=-10,
        spaceAfter=5
    )

    content = []
    
    # ── HEADER BLOCK ──
    content.append(Paragraph("Autonomous AI Knowledge Worker Report", title_style))
    date_str = time.strftime("%B %d, %Y at %I:%M %p")
    content.append(Paragraph(f"Generated on: {date_str} | Source: Integrated Data Feeds", meta_style))
    
    # Divider line
    divider = Table([[""]], colWidths=[504])
    divider.setStyle(TableStyle([
        ('LINEABOVE', (0,0), (-1,-1), 1.5, primary_color),
        ('BOTTOMPADDING', (0,0), (-1,-1), 10),
    ]))
    content.append(divider)
    content.append(Spacer(1, 10))
    
    # ── SECTION 1: STOCK MARKET SNAPSHOT ──
    sentiment_str = sentiment.upper() if sentiment else "NEUTRAL"
    if sentiment_str == "BULLISH":
        badge_color = "#0d9488" # Teal
    elif sentiment_str == "BEARISH":
        badge_color = "#ef4444" # Red
    else:
        badge_color = "#64748b" # Slate
        
    heading_text = f"💹 Stock Market Snapshot <font color='{badge_color}'><b>({sentiment_str})</b></font>"
    content.append(Paragraph(heading_text, h1_style))
    
    if stock:
        # Create a beautiful table
        stock_rows = [["Symbol", "Name", "Price", "Change"]]
        
        # Helper to format a single stock dictionary
        def add_stock_row(s):
            if isinstance(s, dict) and "symbol" in s:
                symbol = s.get("symbol", "N/A")
                price = f"${s.get('price'):.2f}" if s.get('price') is not None else "N/A"
                
                change_val = s.get('change')
                change_pct = s.get('change_percent')
                if change_val is not None and change_pct is not None:
                    change = f"{change_val:+.2f} ({change_pct:+.2f}%)"
                else:
                    change = "N/A"
                    
                name = s.get("name") or symbol
                stock_rows.append([symbol, name, price, change])

        # If stock is a list of stock dicts
        if isinstance(stock, list):
            for s in stock:
                add_stock_row(s)
        # If stock is a single stock dict
        elif isinstance(stock, dict) and "symbol" in stock:
            add_stock_row(stock)
            
        t = Table(stock_rows, colWidths=[80, 200, 100, 124])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#f8fafc")),
            ('TEXTCOLOR', (0,0), (-1,0), primary_color),
            ('ALIGN', (0,0), (-1,-1), 'LEFT'),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('FONTSIZE', (0,0), (-1,0), 9.5),
            ('BOTTOMPADDING', (0,0), (-1,0), 6),
            ('TOPPADDING', (0,0), (-1,0), 6),
            ('LINEBELOW', (0,0), (-1,0), 1.5, primary_color), # border line under header
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.HexColor("#fdfdfd"), colors.white]),
            ('LINEBELOW', (0,1), (-1,-1), 0.5, colors.HexColor("#f1f5f9")), # subtle separator line under each row
            ('FONTNAME', (0,1), (-1,-1), 'Helvetica'),
            ('FONTSIZE', (0,1), (-1,-1), 9),
            ('BOTTOMPADDING', (0,1), (-1,-1), 6),
            ('TOPPADDING', (0,1), (-1,-1), 6),
        ]))
        content.append(t)
    else:
        content.append(Paragraph("No stock market snapshot data was selected.", body_style))
        
    content.append(Spacer(1, 8))
    
    # ── SECTION 2: NEWS SUMMARY ──
    content.append(Paragraph("📰 Latest News Summary", h1_style))
    if news:
        # Show up to 5 articles for detailed reports, 3 for others
        limit_news = 5 if report_type == "detailed" else 3
        for idx, article in enumerate(news[:limit_news]):
            title = article.get("title", "Untitled")
            desc = article.get("description", "No description available.")
            src = article.get("source", "Unknown")
            
            # Truncate descriptions (less truncation for detailed reports)
            max_desc_len = 300 if report_type == "detailed" else 180
            if len(desc) > max_desc_len:
                desc = desc[:max_desc_len - 3] + "..."
            
            content.append(Paragraph(f"<b>{idx+1}. {title}</b> <font color='#64748b'>(Source: {src})</font>", body_style))
            content.append(Paragraph(desc, bullet_style))
            content.append(Spacer(1, 3))
    else:
        content.append(Paragraph("No news articles were selected.", body_style))
        
    content.append(Spacer(1, 8))
    
    # ── SECTION 3: INSIGHTS ──
    content.append(Paragraph("💡 AI-Generated Insights & Highlights", h1_style))
    if insights:
        insight_paragraphs = []
        for insight in insights:
            # support either single string or lists
            if isinstance(insight, str):
                lines = insight.split("\n")
                for line in lines:
                    if line.strip():
                        # remove leading bullet character if any
                        cleaned_line = line.strip().lstrip("•-* ").strip()
                        insight_paragraphs.append(Paragraph(f"• {cleaned_line}", bullet_style))
            else:
                insight_paragraphs.append(Paragraph(f"• {insight}", bullet_style))
        
        # Build cell contents
        insights_cell = []
        for idx, ip in enumerate(insight_paragraphs):
            insights_cell.append(ip)
            if idx < len(insight_paragraphs) - 1:
                insights_cell.append(Spacer(1, 4))
                
        # Callout card container
        callout_table = Table([[insights_cell]], colWidths=[504])
        callout_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f8fafc")),
            ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#e2e8f0")),
            ('LINELEFT', (0,0), (-1,-1), 3, primary_color), # thick purple left accent bar
            ('TOPPADDING', (0,0), (-1,-1), 10),
            ('BOTTOMPADDING', (0,0), (-1,-1), 10),
            ('LEFTPADDING', (0,0), (-1,-1), 12),
            ('RIGHTPADDING', (0,0), (-1,-1), 12),
        ]))
        content.append(callout_table)
    else:
        content.append(Paragraph("No custom insights or analysis were generated.", body_style))
        
    doc.build(content)
    return filename
