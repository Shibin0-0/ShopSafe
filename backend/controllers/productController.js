const Product = require("../models/product");

exports.addProduct = async (req, res) => {
    try {
        const product = new Product(req.body);
        await product.save();
        res.status(201).json(product);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getProducts = async (req, res) => {
    try {
        const products = await Product.find();
        res.json(products);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.deleteProduct = async (req, res) => {
    try {
        await Product.findByIdAndDelete(req.params.id);
        res.json({ message: "Product deleted" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.updateProduct = async (req, res) => {
    try {
        const updated = await Product.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true }
        );
        res.json(updated);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.searchProducts = async (req, res) => {
    try {
        const query = req.query.q;
        console.log(`[Search] Query: "${query}"`);
        if (!query) return res.json([]);

        const products = await Product.find({
            $or: [
                { name: { $regex: query, $options: 'i' } },
                { category: { $regex: query, $options: 'i' } }
            ]
        });

        console.log(`[Search] Found ${products.length} results`);
        res.json(products);
    } catch (error) {
        console.error(`[Search] Error: ${error.message}`);
        res.status(500).json({ message: error.message });
    }
};

exports.fetchBarcodeData = async (req, res) => {
    try {
        const barcode = req.params.code;
        const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
        const data = await response.json();

        if (data.status === 1 && data.product) {
            // Simplify data extraction for frontend
            const productInfo = {
                name: data.product.product_name || "Unknown Product",
                brand: data.product.brands || "",
                imageUrl: data.product.image_front_url || "",
                categories: data.product.categories || "",
                barcode: barcode
            };
            res.json(productInfo);
        } else {
            res.status(404).json({ message: "Product not found in OpenFoodFacts database" });
        }
    } catch (error) {
        console.error(`[Barcode Fetch] Error:`, error);
        res.status(500).json({ message: "Error fetching barcode data" });
    }
};

exports.clearProducts = async (req, res) => {
    try {
        await Product.deleteMany({});
        res.json({ message: "All products deleted successfully" });
    } catch (error) {
        console.error(`[Clear Products] Error: ${error.message}`);
        res.status(500).json({ message: error.message });
    }
};

const nodemailer = require("nodemailer");

exports.sendEmailAlert = async (req, res) => {
    const { fromEmail, toEmail, items } = req.body;
    const finalFrom = fromEmail || process.env.EMAIL_USER;

    if (!finalFrom || !toEmail || !items || items.length === 0) {
        return res.status(400).json({ message: "Missing required fields or empty items list" });
    }

    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        // Separate items
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const expiredItems = [];
        const expiringSoonItems = [];

        items.forEach(item => {
            const expDate = new Date(item.exp_date || item.expiryDate);
            const diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));

            if (diffDays <= 0) {
                expiredItems.push({ ...item, days: diffDays });
            } else {
                expiringSoonItems.push({ ...item, days: diffDays });
            }
        });

        const formatDate = (dateStr) => new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

        const expiredHtml = expiredItems.length > 0 ? `
            <div style="margin-bottom: 24px;">
                <h3 style="color: #ef4444; font-size: 18px; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                    <span style="background: #fee2e2; padding: 4px 8px; border-radius: 4px;">⛔ Expired</span>
                </h3>
                <table style="width: 100%; border-collapse: collapse;">
                    ${expiredItems.map(p => `
                        <tr>
                            <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9;">
                                <strong style="color: #1e293b;">${p.name}</strong><br/>
                                <small style="color: #64748b;">${p.manufacturer || p.company || 'Unknown Brand'}</small>
                            </td>
                            <td style="padding: 10px 0; text-align: right; border-bottom: 1px solid #f1f5f9; color: #ef4444;">
                                Expired: ${formatDate(p.exp_date || p.expiryDate)}
                            </td>
                        </tr>
                    `).join('')}
                </table>
            </div>
        ` : '';

        const expiringSoonHtml = expiringSoonItems.length > 0 ? `
            <div style="margin-bottom: 24px;">
                <h3 style="color: #f59e0b; font-size: 18px; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                    <span style="background: #fef3c7; padding: 4px 8px; border-radius: 4px;">⚠️ Expiring Soon</span>
                </h3>
                <table style="width: 100%; border-collapse: collapse;">
                    ${expiringSoonItems.map(p => `
                        <tr>
                            <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9;">
                                <strong style="color: #1e293b;">${p.name}</strong><br/>
                                <small style="color: #64748b;">${p.manufacturer || p.company || 'Unknown Brand'}</small>
                            </td>
                            <td style="padding: 10px 0; text-align: right; border-bottom: 1px solid #f1f5f9; color: #f59e0b;">
                                in ${p.days} day${p.days > 1 ? 's' : ''} (${formatDate(p.exp_date || p.expiryDate)})
                            </td>
                        </tr>
                    `).join('')}
                </table>
            </div>
        ` : '';

        const mailOptions = {
            from: `ShopSafe Alerts <${finalFrom}>`,
            to: toEmail,
            subject: '⚠️ ShopSafe: Product Expiry Alert',
            html: `
                <!DOCTYPE html>
                <html>
                <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; margin: 0; padding: 40px 0;">
                    <center>
                        <table style="width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                            <tr>
                                <td style="padding: 32px 40px; background: linear-gradient(135deg, #4f46e5 0%, #3730a3 100%); text-align: center;">
                                    <h1 style="color: white; margin: 0; font-size: 28px; letter-spacing: -0.5px;">ShopSafe</h1>
                                    <p style="color: rgba(255,255,255,0.8); margin-top: 8px;">Your Personal Expiry Guardian</p>
                                </td>
                            </tr>
                            <tr>
                                <td style="padding: 40px;">
                                    <h2 style="color: #1e293b; margin-top: 0;">Inventory Alert</h2>
                                    <p style="color: #64748b; font-size: 16px; line-height: 1.6;">
                                        Hello, we detected some items in your inventory that need your attention.
                                    </p>
                                    
                                    ${expiredHtml}
                                    ${expiringSoonHtml}
                                </td>
                            </tr>
                            <tr>
                                <td style="padding: 24px; text-align: center; border-top: 1px solid #f1f5f9; color: #94a3b8; font-size: 12px;">
                                    &copy; 2026 ShopSafe App. All rights reserved.<br/>
                                    Protecting you from expired products, one item at a time.
                                </td>
                            </tr>
                        </table>
                    </center>
                </body>
                </html>
            `
        };

        await transporter.sendMail(mailOptions);
        res.json({ message: "Alert email sent successfully" });
    } catch (error) {
        console.error(`[Email Alert] Error: ${error.message}`);
        res.status(500).json({ message: "Failed to send email alert. Ensure EMAIL_USER and EMAIL_PASS are set in .env" });
    }
};