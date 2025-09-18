const express = require('express');
const Canvas = require('canvas');
const axios = require('axios');

const app = express();
const port = 3000;

// Função auxiliar para baixar o buffer da imagem de um item
async function baixarItemBuffer(itemId, tipo = "Item") {
    try {
        const url = `https://freefireapi.com/api/item/${itemId}`;
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        return Buffer.from(response.data);
    } catch (error) {
        console.error(`Erro ao baixar ${tipo} ${itemId}:`, error.message);
        return null;
    }
}

// Rota de demonstração que funciona sem dados reais
app.get('/demo', async (req, res) => {
    try {
        console.log('\n🔹 Gerando demonstração da lista de desejos');

        // 3. Configurar o canvas
        const canvasW = 1280;
        const canvasH = 720;
        const canvas = Canvas.createCanvas(canvasW, canvasH);
        const ctx = canvas.getContext("2d");

        // Carregar e desenhar o fundo
        const backgroundUrl = "https://files.catbox.moe/q4uv15.jpg";
        try {
            const backgroundImg = await Canvas.loadImage(backgroundUrl);
            ctx.drawImage(backgroundImg, 0, 0, canvasW, canvasH);
            console.log("✅ Fundo desenhado.");
        } catch (err) {
            console.error("❌ Falha ao carregar a imagem de fundo:", err.message);
            // Fallback para um fundo sólido caso a imagem não carregue
            ctx.fillStyle = "#101010";
            ctx.fillRect(0, 0, canvasW, canvasH);
        }

        // 4. Desenhar retângulos coloridos como demonstração
        const columns = 3;
        const itemSize = 180;
        const padding = 30;
        
        const startX = 100; 
        const startY = (canvasH - Math.ceil(9 / columns) * (itemSize + padding)) / 2 + 40;

        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE'];

        for (let i = 0; i < 9; i++) {
            const row = Math.floor(i / columns);
            const col = i % columns;

            const x = startX + col * (itemSize + padding);
            const y = startY + row * (itemSize + padding);

            // Adiciona uma sombra suave
            ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
            ctx.shadowBlur = 15;
            ctx.shadowOffsetX = 5;
            ctx.shadowOffsetY = 5;
            
            // Desenha um retângulo colorido
            ctx.fillStyle = colors[i];
            ctx.fillRect(x, y, itemSize, itemSize);

            // Limpa a sombra
            ctx.shadowColor = "transparent";
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;

            // Adiciona texto no centro
            ctx.fillStyle = 'white';
            ctx.font = 'bold 24px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`Item ${i + 1}`, x + itemSize/2, y + itemSize/2 + 8);
        }
        console.log("✅ Demonstração desenhada na imagem.");

        // 5. Enviar a imagem como resposta
        res.setHeader("Content-Type", "image/png");
        res.send(canvas.toBuffer("image/png"));
        console.log("✅ Imagem de demonstração enviada com sucesso!");

    } catch (err) {
        console.error("❌ Erro geral na rota /demo:", err);
        res.status(500).json({ error: "Erro interno ao gerar a imagem de demonstração." });
    }
});

// Rota para a lista de desejos
app.get('/lista-de-desejos', async (req, res) => {
    try {
        const { id, region = 'br' } = req.query;
        if (!id) {
            return res.status(400).json({ error: "O parâmetro 'id' é obrigatório." });
        }

        console.log(`\n🔹 Gerando lista de desejos para ID: ${id} na região: ${region}`);

        // 1. Buscar dados da API
        const apiUrl = `https://freefireapis.squareweb.app/api/wishlist?id=${id}&region=${region}`;
        const { data: apiData } = await axios.get(apiUrl);

        if (!apiData.success || !apiData.wishlistBasicInfo || !apiData.wishlistBasicInfo.Items) {
            console.log("⚠️ A API não retornou uma lista de desejos válida.");
            return res.status(404).json({ error: "Lista de desejos não encontrada ou vazia." });
        }

        // Pegar apenas os 9 primeiros itens
        const wishlistItems = apiData.wishlistBasicInfo.Items.slice(0, 9);
        if (wishlistItems.length === 0) {
            return res.status(404).json({ error: "Nenhum item na lista de desejos." });
        }
        
        console.log(`🔸 Itens encontrados: ${wishlistItems.length}`);

        // 2. Baixar as imagens dos itens
        const itemBuffers = await Promise.all(
            wishlistItems.map(item => baixarItemBuffer(item.itemId, "Desejo"))
        );

        const validBuffers = itemBuffers.filter(Boolean);
        console.log(`✅ Buffers de imagem prontos: ${validBuffers.length}`);

        if (validBuffers.length === 0) {
            return res.status(500).json({ error: "Não foi possível baixar as imagens dos itens." });
        }

        // 3. Configurar o canvas
        const canvasW = 1280;
        const canvasH = 720;
        const canvas = Canvas.createCanvas(canvasW, canvasH);
        const ctx = canvas.getContext("2d");

        // Carregar e desenhar o fundo
        const backgroundUrl = "https://files.catbox.moe/q4uv15.jpg";
        try {
            const backgroundImg = await Canvas.loadImage(backgroundUrl);
            ctx.drawImage(backgroundImg, 0, 0, canvasW, canvasH);
            console.log("✅ Fundo desenhado.");
        } catch (err) {
            console.error("❌ Falha ao carregar a imagem de fundo:", err.message);
            // Fallback para um fundo sólido caso a imagem não carregue
            ctx.fillStyle = "#101010";
            ctx.fillRect(0, 0, canvasW, canvasH);
        }

        // 4. Desenhar os itens na imagem
        const columns = 3;
        const itemSize = 180; // Tamanho de cada item
        const padding = 30;   // Espaçamento entre os itens
        
        // Ponto inicial da grade, deslocado para a direita
        const startX = 100; 
        const startY = (canvasH - Math.ceil(validBuffers.length / columns) * (itemSize + padding)) / 2 + 40;

        for (let i = 0; i < validBuffers.length; i++) {
            const row = Math.floor(i / columns);
            const col = i % columns;

            const x = startX + col * (itemSize + padding);
            const y = startY + row * (itemSize + padding);

            try {
                const itemImg = await Canvas.loadImage(validBuffers[i]);
                
                // Adiciona uma sombra suave para destacar o item
                ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
                ctx.shadowBlur = 15;
                ctx.shadowOffsetX = 5;
                ctx.shadowOffsetY = 5;
                
                ctx.drawImage(itemImg, x, y, itemSize, itemSize);

                // Limpa a sombra para o próximo desenho
                ctx.shadowColor = "transparent";
                ctx.shadowBlur = 0;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;

            } catch (err) {
                console.error(`❌ Erro ao desenhar o item ${wishlistItems[i].itemId}:`, err.message);
            }
        }
        console.log("✅ Itens desenhados na imagem.");

        // 5. Enviar a imagem como resposta
        res.setHeader("Content-Type", "image/png");
        res.send(canvas.toBuffer("image/png"));
        console.log("✅ Imagem da lista de desejos enviada com sucesso!");

    } catch (err) {
        console.error("❌ Erro geral na rota /lista-de-desejos:", err);
        res.status(500).json({ error: "Erro interno ao gerar a imagem da lista de desejos." });
    }
});

app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});


