from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet

def generate_pdf(news, stock, insights):
    filename = "report.pdf"
    doc = SimpleDocTemplate(filename)
    styles = getSampleStyleSheet()
    content = []

    content.append(Paragraph("📄 Project Report", styles["Title"]))
    content.append(Spacer(1, 20))

    content.append(Paragraph("📰 News Summary", styles["Heading2"]))
    for article in news[:5]:
        content.append(Paragraph(article["title"], styles["Normal"]))
    content.append(Spacer(1, 12))

    content.append(Paragraph("💹 Stock Summary", styles["Heading2"]))
    if stock:
        content.append(Paragraph(f"{stock.get('symbol')} @ {stock.get('price')}", styles["Normal"]))
    else:
        content.append(Paragraph("No stock data", styles["Normal"]))

    content.append(Spacer(1, 12))
    content.append(Paragraph("💡 Insights", styles["Heading2"]))
    for i in insights:
        content.append(Paragraph(i, styles["Normal"]))

    doc.build(content)
    return filename
