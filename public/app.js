/**
 * SISTEMA DE ETIQUETAS ONE BOX
 * app.js - Gestión de búsqueda e impresión Zebra
 */

let selected_device;
// CONFIGURACIÓN: Cambia esta URL por la que te dé Render al desplegar el servidor
const SERVIDOR_URL = "https://www.etiquetas.onebox.net.ar"; 

// 1. INICIALIZAR IMPRESORA (BrowserPrint local)
window.onload = function() {
    // El software BrowserPrint debe estar corriendo en la PC donde está la Zebra
    BrowserPrint.getDefaultDevice("printer", function(device) {
        if (device != null && device.connection != undefined) {
            selected_device = device;
            const select = document.getElementById('selImpresora');
            
            // Limpiar y cargar impresora detectada
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

// 2. BUSCAR PRODUCTO (Al presionar Enter en el input de Código)
document.getElementById('txtCodigo').addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') {
        const codigo = e.target.value.trim();
        const lista = document.getElementById('selLista').value;

        if (!codigo) return;

        try {
            // Consultamos al servidor en la nube (Render)
            const resp = await fetch(`${SERVIDOR_URL}/api/producto/${codigo}?lista=${lista}`);
            const data = await resp.json();

            if (data.success) {
                // Llenamos la interfaz con la descripción de TiDB
                document.getElementById('txtDetalle').value = data.descripcion;
                
                // Guardamos los datos en una variable global para imprimir
                window.currentProduct = data;
                console.log("📦 Producto cargado:", data);
            } else {
                alert("❌ Producto no encontrado en la base de datos.");
                document.getElementById('txtDetalle').value = "";
                window.currentProduct = null;
                e.target.select(); // Selecciona el texto para corregir rápido
            }
        } catch (err) {
            console.error("Error de conexión con el servidor:", err);
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

    // Formatear precio para la etiqueta
    const precioNumerico = parseFloat(p.precio) || 0;
    const precioTxt = sinPrecio ? "" : `$ ${precioNumerico.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    let epl = "";

    if (formato === "x3") {
        // --- FORMATO 3 ETIQUETAS CHICAS (X3) ---
        // Ajustamos la descripción para que no se pise (máximo 18 caracteres)
        const descCorta = p.descripcion.substring(0, 18);
        
        epl = `
N
A15,10,0,2,1,1,N,"${descCorta}"
B15,35,0,1,2,2,50,B,"${p.codigo}"
A15,95,0,2,1,1,N,"${precioTxt}"

A270,10,0,2,1,1,N,"${descCorta}"
B270,35,0,1,2,2,50,B,"${p.codigo}"
A270,95,0,2,1,1,N,"${precioTxt}"

A525,10,0,2,1,1,N,"${descCorta}"
B525,35,0,1,2,2,50,B,"${p.codigo}"
A525,95,0,2,1,1,N,"${precioTxt}"
P${copias}
`;
    } else {
        // --- FORMATO ETIQUETA SIMPLE (GRANDE) ---
        epl = `
N
A50,20,0,3,1,1,N,"${p.descripcion}"
B50,60,0,1,2,3,80,B,"${p.codigo}"
A50,160,0,4,1,1,N,"${precioTxt}"
P${copias}
`;
    }

    // Enviar el comando EPL directo a la Zebra
    selected_device.send(epl, function(success) {
        console.log("✅ Impresión enviada con éxito.");
        // Opcional: limpiar el campo de código para el siguiente producto
        document.getElementById('txtCodigo').value = "";
        document.getElementById('txtCodigo').focus();
    }, function(error) {
        alert("❌ Error al imprimir: " + error);
    });
};