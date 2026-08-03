"""Catálogo supermercado: categorías por defecto (nombre + descripción)."""

from __future__ import annotations

# (nombre, descripcion) — nombres únicos; el seed/onboard las crea si faltan.
CATEGORIAS_SUPERMERCADO: list[tuple[str, str]] = [
    # Productos Frescos y Perecederos
    (
        "Frutas y Verduras",
        "Frutas de temporada, vegetales, hierbas aromáticas y ensaladas preparadas.",
    ),
    (
        "Carnes y Aves",
        "Pollo, vacuno, cerdo, pavo y cortes para asado.",
    ),
    (
        "Pescados y Mariscos",
        "Filetes frescos, mariscos selectos y productos congelados del mar.",
    ),
    (
        "Fiambrería y Charcutería",
        "Jamón, quesos al corte, salames y cecinas.",
    ),
    (
        "Panadería y Pastelería",
        "Pan fresco del día, pasteles, bollería y tortas.",
    ),
    # Despensa y Abarrotes
    (
        "Arroz, Legumbres y Pastas",
        "Fideos, arroz, lentejas, garbanzos y harinas.",
    ),
    (
        "Aceites, Condimentos y Salsas",
        "Aceite de oliva, vinagre, sal, especias, kétchup, mayonesa y salsa de tomate.",
    ),
    (
        "Conservas y Enlatados",
        "Atún, verduras en tarro, legumbres cocidas y frutas en almíbar.",
    ),
    (
        "Desayuno y Merienda",
        "Café, té, cereales, galletas, mermeladas y miel.",
    ),
    (
        "Snacks y Confitería",
        "Papas fritas, frutos secos, chocolates y caramelos.",
    ),
    # Lácteos y Refrigerados
    (
        "Leches y Alternativas",
        "Leche entera, descremada, sin lactosa y bebidas vegetales (almendra, soya).",
    ),
    (
        "Yogures y Postres",
        "Yogur natural, con frutas, flanes y gelatinas.",
    ),
    (
        "Mantequillas y Margarinas",
        "Mantequilla con/sin sal y esparcibles.",
    ),
    (
        "Quesos Envasados",
        "Queso laminado, rallado, crema y quesos maduros.",
    ),
    (
        "Platos Preparados",
        "Masas de pizza, pastas frescas y comidas listas para calentar.",
    ),
    # Congelados
    (
        "Verduras Congeladas",
        "Arvejas, choclo, papas fritas listas y mezclas de vegetales.",
    ),
    (
        "Comidas Listas",
        "Pizzas, hamburguesas, nuggets y platos precocinados.",
    ),
    (
        "Helados y Postres",
        "Paletas, potes de helado y hielos.",
    ),
    # Bebidas y Licores
    (
        "Aguas y Bebidas Analcohólicas",
        "Agua mineral, gaseosas, jugos y bebidas energéticas.",
    ),
    (
        "Cervezas, Vinos y Licores",
        "Vinos tintos y blancos, cervezas artesanales e industriales, y destilados.",
    ),
    # Cuidado Personal y Salud
    (
        "Higiene Capilar y Corporal",
        "Champú, acondicionador, jabón, geles de ducha y desodorantes.",
    ),
    (
        "Salud Oral",
        "Pasta de dientes, cepillos y enjuague bucal.",
    ),
    (
        "Afeitado y Depilación",
        "Máquinas de afeitar, espumas y bandas depilatorias.",
    ),
    (
        "Higiene Femenina y Adulto",
        "Toallas higiénicas, tampones y pañales para adultos.",
    ),
    # Limpieza y Hogar
    (
        "Cuidado de la Ropa",
        "Detergentes, suavizantes y quitamanchas.",
    ),
    (
        "Limpieza de Superficies",
        "Desinfectantes, lavalozas, limpiadores de piso y desengrasantes.",
    ),
    (
        "Utensilios de Limpieza",
        "Esponjas, paños de microfibra, escobas y bolsas de basura.",
    ),
    (
        "Celulosas",
        "Papel higiénico, toallas de papel y servilletas.",
    ),
    # Mascotas, Bebés y Otros
    (
        "Mascotas",
        "Alimento para perros y gatos (seco y húmedo), arena sanitaria y juguetes.",
    ),
    (
        "Bebés",
        "Pañales, toallitas húmedas, fórmulas lácteas y colados.",
    ),
    (
        "Bazar y Hogar",
        "Pilas, ampolletas, velas y utensilios básicos de cocina.",
    ),
]
