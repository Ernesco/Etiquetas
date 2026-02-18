/**
 * SISTEMA DE ETIQUETAS ONE BOX
 * app.js - Gestión de búsqueda e impresión Zebra
 */

let selected_device;
const SERVIDOR_URL = "https://www.etiquetas.onebox.net.ar"; 

// 1. INICIALIZAR IMPRESORA (BrowserPrint local)
window.onload = function() {
    BrowserPrint.getDefaultDevice("printer", function(device) {
        if (device != null && device.connection != undefined) {
            selected_device = device;
            const select = document.getElementById('selImpresora');
            select.innerHTML = ""; 
            let opt = document.createElement('option');
            opt.text = device.name;
            opt.value = device.uid;
            select.appendChild(opt);
            console.log("🚀 Impresora Zebra detectada y lista: " + device.name);
        } else {
            console.warn("⚠️ No se encontró ninguna impresora Zebra por USB.");
            alert("Asegúrate de que la Zebra esté encendida y BrowserPrint abierto.");
        }
    }, function(error) {
        alert("Error de conexión con Zebra Browser Print: " + error);
    });
};

// 2. BUSCAR PRODUCTO
document.getElementById('txtCodigo').addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') {
        const codigo = e.target.value.trim();
        const lista = document.getElementById('selLista').value;
        if (!codigo) return;

        try {
            const resp = await fetch(`${SERVIDOR_URL}/api/producto/${codigo}?lista=${lista}`);
            const data = await resp.json();

            if (data.success) {
                document.getElementById('txtDetalle').value = data.descripcion;
                window.currentProduct = data;
                console.log("📦 Producto cargado:", data);
            } else {
                alert("❌ Producto no encontrado en la base de datos.");
                document.getElementById('txtDetalle').value = "";
                window.currentProduct = null;
                e.target.select();
            }
        } catch (err) {
            console.error("Error de conexión:", err);
            alert("Error: No se pudo conectar con etiquetas.onebox.net.ar");
        }
    }
});

// 3. LOGICA DE IMPRESIÓN (Comandos EPL)
document.getElementById('btnImprimir').onclick = function() {
    if (!selected_device) return alert("❌ No hay impresora seleccionada.");
    if (!window.currentProduct) return alert("⚠️ Primero busca un producto por código.");

    const p = window.currentProduct;
    const sinPrecio = document.getElementById('chkSinPrecio').checked;
    const formato = document.getElementById('selFormato').value;
    const copias = document.getElementById('numCopias').value || 1;

    const precioNumerico = parseFloat(p.precio) || 0;
    const precioTxt = sinPrecio ? "" : `$ ${precioNumerico.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    let epl = "";

    if (formato === "x3") {
        // --- FORMATO 3 ETIQUETAS (94mm x 20mm total) ---
        // Máximo 14 caracteres para evitar que se pise con la etiqueta de al lado
        const descCorta = p.descripcion.substring(0, 14).toUpperCase();
        
        epl = `
N
q752
Q160,24
A15,5,0,2,1,1,N,"${descCorta}"
B15,30,0,1,2,2,60,B,"${p.codigo}"
A15,100,0,2,1,1,N,"${precioTxt}"

A265,5,0,2,1,1,N,"${descCorta}"
B265,30,0,1,2,2,60,B,"${p.codigo}"
A265,100,0,2,1,1,N,"${precioTxt}"

A515,5,0,2,1,1,N,"${descCorta}"
B515,30,0,1,2,2,60,B,"${p.codigo}"
A515,100,0,2,1,1,N,"${precioTxt}"
P${copias}
`;
    } else {
        // --- FORMATO ETIQUETA SIMPLE (Ajustada a 20mm de alto) ---
        epl = `
N
q752
Q160,24
A50,10,0,3,1,1,N,"${p.descripcion.substring(0, 25)}"
B50,45,0,1,2,3,70,B,"${p.codigo}"
A50,125,0,4,1,1,N,"${precioTxt}"
P${copias}
`;
    }

    selected_device.send(epl, function(success) {
        console.log("✅ Impresión enviada.");
        document.getElementById('txtCodigo').value = "";
        document.getElementById('txtCodigo').focus();
    }, function(error) {
        alert("❌ Error al imprimir: " + error);
    });
};