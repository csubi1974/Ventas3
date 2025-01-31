/*
  # Insertar clientes iniciales

  1. Nuevos Registros
    - Inserta los primeros clientes del sistema
    - Incluye datos básicos como nombre, RUT, código y dirección
    - Agrega datos de contacto donde sea necesario

  2. Datos
    - Se mantienen los RUTs originales
    - Se generan códigos únicos basados en el nombre
    - Se agregan direcciones ficticias pero realistas
*/

INSERT INTO customers (
  code,
  rut,
  full_name,
  type,
  street,
  number,
  district,
  city,
  phone,
  email,
  reference
) VALUES
  ('VV001', '56942750', 'VERONICA VARGAS', 'personal', 'Los Alerces', '234', 'La Florida', 'Santiago', '+56912345678', 'vvargas@email.com', 'Casa color beige'),
  ('RS001', '84606090', 'REVAL SPA', 'business', 'Av. Providencia', '1550', 'Providencia', 'Santiago', '+56922334455', 'contacto@revalspa.cl', 'Oficina 505'),
  ('SA001', '85273282', 'SERGIO AROS', 'personal', 'Los Cerezos', '567', 'Puente Alto', 'Santiago', '+56933445566', 'saros@email.com', 'Condominio Los Cerezos'),
  ('JA001', '44038601', 'JOHANA ALARCON', 'personal', 'Las Dalias', '123', 'Maipú', 'Santiago', '+56944556677', 'jalarcon@email.com', 'Cerca de la plaza'),
  ('GJ001', '56693972', 'GONZALO JULIAN', 'personal', 'Los Olmos', '789', 'La Reina', 'Santiago', '+56955667788', 'gjulian@email.com', 'Casa esquina'),
  ('LO001', '30971918', 'LORENA OYARZO', 'personal', 'Las Acacias', '432', 'Ñuñoa', 'Santiago', '+56966778899', 'loyarzo@email.com', 'Edificio Las Acacias'),
  ('JM001', '66017486', 'JESSICA MIRANDA', 'personal', 'Los Pinos', '876', 'San Miguel', 'Santiago', '+56977889900', 'jmiranda@email.com', 'Casa verde'),
  ('LA001', '83746771', 'LORENA APABLAZA', 'personal', 'Las Rosas', '345', 'La Cisterna', 'Santiago', '+56988990011', 'lapablaza@email.com', 'Frente al parque'),
  ('CG001', '82903820', 'CELINE GIRARDOT', 'personal', 'Los Jazmines', '654', 'Macul', 'Santiago', '+56999001122', 'cgirardot@email.com', 'Casa con reja negra'),
  ('BF001', '56170005', 'BERNARDA FIGUEROA', 'personal', 'Las Violetas', '987', 'San Joaquín', 'Santiago', '+56900112233', 'bfigueroa@email.com', 'Al lado del almacén'),
  ('MC001', '79572259', 'MARIA IGNACIA CASTILLO', 'personal', 'Los Laureles', '234', 'Peñalolén', 'Santiago', '+56911223344', 'micastillo@email.com', 'Casa con antejardín'),
  ('NH001', '50012557', 'NOCOLE HERNANDEZ', 'personal', 'Las Camelias', '567', 'La Granja', 'Santiago', '+56922334455', 'nhernandez@email.com', 'Casa amarilla'),
  ('BB001', '93498294', 'BLANCA BAHAMONDE', 'personal', 'Los Tulipanes', '890', 'El Bosque', 'Santiago', '+56933445566', 'bbahamonde@email.com', 'Cerca del consultorio'),
  ('EC001', '98404022', 'EVA CARCAMO', 'personal', 'Las Azucenas', '123', 'Pedro Aguirre Cerda', 'Santiago', '+56944556677', 'ecarcamo@email.com', 'Casa con portón café'),
  ('SG001', '89221277', 'SANDRA GOMEZ', 'personal', 'Los Claveles', '456', 'Lo Prado', 'Santiago', '+56955667788', 'sgomez@email.com', 'Frente a la escuela'),
  ('BB002', '56590113', 'BESSIE BARRA', 'personal', 'Las Margaritas', '789', 'Cerro Navia', 'Santiago', '+56966778899', 'bbarra@email.com', 'Casa con terraza'),
  ('JO001', '79885822', 'JUAN OYARZO', 'personal', 'Los Lirios', '012', 'Quinta Normal', 'Santiago', '+56977889900', 'joyarzo@email.com', 'Casa con árbol grande');