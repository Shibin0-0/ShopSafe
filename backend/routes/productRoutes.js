const express = require("express");

const router = express.Router();

const {
    addProduct,
    getProducts,
    deleteProduct,
    searchProducts,
    updateProduct,
    clearProducts,
    fetchBarcodeData,
    sendEmailAlert
} = require("../controllers/productController");

router.post("/", addProduct);

router.get("/search", searchProducts);

router.get("/barcode/:code", fetchBarcodeData);

router.get("/", getProducts);

router.put("/:id", updateProduct);

router.delete("/clear", clearProducts);

router.delete("/:id", deleteProduct);

router.post("/send-alert", sendEmailAlert);

module.exports = router;