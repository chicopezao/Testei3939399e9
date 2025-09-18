const express = require('express');
const Canvas = require('canvas');
const { loadImage } = Canvas;
const axios = require('axios');

const app = express();
const port = 3000;

// helper: baixa item do ItemID2 (retorna Buffer) com fallback CDN
async function baixarItemBuffer(itemId, tipo = "Item") {
  try {
    console.log(`🔍 [${tipo}] buscando item ${itemId}`);
    const { data: items } = await axios.get("https://0xme.github.io/ItemID2/assets/itemData.json");
    const item = items.find(i => String(i.itemID) === String(itemId));
    if (!item) {
      console.log(`⚠️ [${tipo}] item ${itemId} não encontrado`);
      return null;
    }
    const { data: cdnList } = await axios.get("https://0xme.github.io/ItemID2/assets/cdn.json");
    const cdn_img_json = cdnList.reduce((acc, cur) => Object.assign(acc, cur), {});
    let url = `https://raw.githubusercontent.com/0xme/ff-resources/refs/heads/main/pngs/300x300/${item.icon}.png`;
    try {
      await axios.head(url);
    } catch {
      const fb = cdn_img_json[itemId];
      if (!fb) {
        console.log(`❌ [${tipo}] sem fallback pra ${itemId}`);
        return null;
      }
      url = fb;
      console.log(`⚠️ [${tipo}] usando fallback: ${url}`);
    }
    const res = await axios.get(url, { responseType: "arraybuffer" });
    console.log(`📥 [${tipo}] baixado ${itemId}`);
    return Buffer.from(res.data);
  } catch (err) {
    console.error(`❌ Erro baixar ${itemId}: ${err.message}`);
    return null;
  }
}

// rota lista de desejos
app.get('/lista-de-desejos', async (req, res) => {
  try {
    const { id, region = 'br' } = req.query;
    if (!id) return res.status(400).json({ error: "O parâmetro 'id' é obrigatório." });

    console.log(`\n🔹 Gerando lista de desejos para ID: ${id} na região: ${region}`);

    const apiUrl = `https://freefireapis.squareweb.app/api/wishlist?id=${id}&region=${region}`;
    const { data: apiData } = await axios.get(apiUrl);

    if (!apiData.success || !apiData.wishlistBasicInfo || !apiData.wishlistBasicInfo.Items) {
      return res.status(404).json({ error: "Lista de desejos não encontrada ou vazia." });
    }

    const wishlistItems = apiData.wishlistBasicInfo.Items.slice(0, 9);
    if (wishlistItems.length === 0) return res.status(404).json({ error: "Nenhum item na lista de desejos." });

    console.log(`🔸 Itens encontrados: ${wishlistItems.length}`);

    // baixar imagens usando ItemID2
    const itemBuffers = await Promise.all(
      wishlistItems.map(item => baixarItemBuffer(item.itemId, "Desejo"))
    );
    const validBuffers = itemBuffers.filter(Boolean);
    console.log(`✅ Buffers de imagem prontos: ${validBuffers.length}`);
    if (validBuffers.length === 0) return res.status(500).json({ error: "Não foi possível baixar as imagens dos itens." });

    // canvas
    const canvasW = 1280;
    const canvasH = 720;
    const canvas = Canvas.createCanvas(canvasW, canvasH);
    const ctx = canvas.getContext("2d");

    // fundo
    const backgroundUrl = "https://files.catbox.moe/q4uv15.jpg";
    try {
      const bgImg = await loadImage(backgroundUrl);
      ctx.drawImage(bgImg, 0, 0, canvasW, canvasH);
    } catch {
      ctx.fillStyle = "#101010";
      ctx.fillRect(0, 0, canvasW, canvasH);
    }

    // grade de itens
    const columns = 3;
    const itemSize = 180;
    const padding = 30;
    const startX = 700; // ⬅️ alinhado à esquerda
    const startY = (canvasH - Math.ceil(validBuffers.length / columns) * (itemSize + padding)) / 2;

    for (let i = 0; i < validBuffers.length; i++) {
      const row = Math.floor(i / columns);
      const col = i % columns;
      const x = startX + col * (itemSize + padding);
      const y = startY + row * (itemSize + padding);

      try {
        const img = await loadImage(validBuffers[i]);
        ctx.shadowColor = "rgba(0,0,0,0.7)";
        ctx.shadowBlur = 15;
        ctx.shadowOffsetX = 5;
        ctx.shadowOffsetY = 5;

        ctx.drawImage(img, x, y, itemSize, itemSize);

        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

      } catch (err) {
        console.error(`❌ Erro desenhar item ${wishlistItems[i].itemId}:`, err.message);
      }
    }

    res.setHeader("Content-Type", "image/png");
    res.send(canvas.toBuffer("image/png"));
    console.log("✅ Imagem da lista de desejos enviada com sucesso!");

  } catch (err) {
    console.error("❌ Erro geral na rota /lista-de-desejos:", err);
    res.status(500).json({ error: "Erro interno ao gerar a imagem da lista de desejos." });
  }
});

app.listen(port, () => console.log(`Servidor rodando em http://localhost:${port}`));
