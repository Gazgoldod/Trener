// =====================================================================
//  ПРОГРАММА ТРЕНИРОВОК — здесь можно менять упражнения и схемы.
//  Приложение берёт эту программу при первом запуске. Потом изменения
//  делаются прямо в приложении (вкладка «Программа»).
// =====================================================================

// Группы мышц. Цвета подобраны так, чтобы их различали и люди с особенностями зрения.
// target — сколько рабочих подходов в неделю считать нормой для роста.
const GROUPS = {
  chest:     { name: 'Грудь',  color: '#E5484D', target: [10, 20] },
  back:      { name: 'Спина',  color: '#3B74E0', target: [10, 20] },
  arms:      { name: 'Руки',   color: '#2FA35A', target: [10, 18] },
  shoulders: { name: 'Плечи',  color: '#A56CDB', target: [6, 14] },
  abs:       { name: 'Пресс',  color: '#C97A22', target: [6, 15] },
  knee:      { name: 'Колено', color: '#1C9FB0', target: [4, 10] },
};

// Тип упражнения влияет на отдых и на то, как считается прогресс:
//   big  — базовое (жим, тяга), отдых длиннее
//   iso  — изолирующее (бицепс, махи)
//   body — с весом своего тела (вес = дополнительный груз, 0 — без груза)
//   time — на время (в поле «повторы» пишутся секунды)
//   knee — укрепление колена, лёгкий вес, короткий отдых
//
// Поля: name — название, group — группа мышц, place — 'gym' (зал) или 'home' (дом),
// sets — подходов, reps — диапазон повторений [от, до], step — на сколько кг
// прибавлять, note — подсказка по технике.
const EXERCISES = {
  // ---------- ЗАЛ: ГРУДЬ ----------
  g_incline_db:   { name: 'Жим гантелей на наклонной скамье', group: 'chest', place: 'gym', type: 'big', sets: 3, reps: [6, 10], step: 2,
                    note: 'Вес — одной гантели. Скамья 30°. Лопатки сведены, локти под углом ~45° к телу — так бережём левое плечо.' },
  g_bench:        { name: 'Жим штанги лёжа', group: 'chest', place: 'gym', type: 'big', sets: 3, reps: [6, 10], step: 2.5,
                    note: 'Хват чуть шире плеч, штанга опускается на низ груди. Без отбива от груди.' },
  g_chest_press:  { name: 'Жим в тренажёре сидя', group: 'chest', place: 'gym', type: 'big', sets: 3, reps: [8, 12], step: 5,
                    note: 'Ручки на уровне середины груди. Внизу не растягивай плечо сильнее, чем комфортно.' },
  g_hammer_incl:  { name: 'Жим в рычажном тренажёре под углом', group: 'chest', place: 'gym', type: 'big', sets: 3, reps: [8, 12], step: 5,
                    note: 'Хорошая замена жиму на наклонной, если плечо капризничает.' },
  g_fly_cable:    { name: 'Сведение рук в кроссовере', group: 'chest', place: 'gym', type: 'iso', sets: 3, reps: [12, 15], step: 2.5,
                    note: 'Руки чуть согнуты, сводим перед грудью, пауза 1 секунда.' },
  g_pec_deck:     { name: 'Сведение рук в тренажёре «бабочка»', group: 'chest', place: 'gym', type: 'iso', sets: 3, reps: [12, 15], step: 5,
                    note: 'Не разводи руки слишком далеко назад — бережём плечо.' },

  // ---------- ЗАЛ: СПИНА ----------
  g_pullup:       { name: 'Подтягивания', group: 'back', place: 'gym', type: 'body', sets: 3, reps: [6, 10], step: 2.5,
                    note: 'Вес — дополнительный груз (0 — без груза). Без рывков, вниз медленно 2–3 секунды. Если тяжело — гравитрон.' },
  g_lat_pulldown: { name: 'Тяга верхнего блока к груди', group: 'back', place: 'gym', type: 'big', sets: 3, reps: [8, 12], step: 5,
                    note: 'Тянем локтями вниз к бокам, грудь вперёд. Не за голову.' },
  g_cable_row:    { name: 'Тяга горизонтального блока', group: 'back', place: 'gym', type: 'big', sets: 3, reps: [8, 12], step: 5,
                    note: 'Ноги чуть согнуты, спина ровная. Тянем к животу, сводим лопатки.' },
  g_tbar:         { name: 'Тяга Т-грифа с упором грудью', group: 'back', place: 'gym', type: 'big', sets: 3, reps: [8, 12], step: 5,
                    note: 'Упор грудью снимает нагрузку с поясницы и ног.' },
  g_machine_row:  { name: 'Тяга в рычажном тренажёре', group: 'back', place: 'gym', type: 'big', sets: 3, reps: [8, 12], step: 5,
                    note: 'Можно по одной руке — так легче почувствовать широчайшую.' },
  g_pullover:     { name: 'Пуловер на верхнем блоке', group: 'back', place: 'gym', type: 'iso', sets: 2, reps: [12, 15], step: 2.5,
                    note: 'Руки почти прямые, ведём рукоять от уровня глаз к бёдрам.' },

  // ---------- ЗАЛ: РУКИ ----------
  g_ez_curl:      { name: 'Подъём штанги EZ на бицепс', group: 'arms', place: 'gym', type: 'iso', sets: 3, reps: [8, 12], step: 2.5,
                    note: 'Локти прижаты, без раскачки корпусом.' },
  g_preacher:     { name: 'Сгибания на скамье Скотта', group: 'arms', place: 'gym', type: 'iso', sets: 3, reps: [10, 12], step: 2.5,
                    note: 'Внизу не выпрямляй руку до щелчка — держи лёгкое напряжение.' },
  g_cable_curl:   { name: 'Сгибания на нижнем блоке', group: 'arms', place: 'gym', type: 'iso', sets: 3, reps: [10, 15], step: 2.5,
                    note: 'Постоянное натяжение, пауза наверху.' },
  g_pushdown:     { name: 'Разгибания рук на блоке (канат)', group: 'arms', place: 'gym', type: 'iso', sets: 3, reps: [10, 12], step: 2.5,
                    note: 'Локти неподвижны, внизу разводим канат в стороны.' },
  g_oh_cable:     { name: 'Разгибания на блоке из-за головы', group: 'arms', place: 'gym', type: 'iso', sets: 3, reps: [10, 12], step: 2.5,
                    note: 'Если левое плечо отзывается — замени на разгибания с канатом вниз.' },

  // ---------- ЗАЛ: ПЛЕЧИ ----------
  g_face_pull:    { name: 'Тяга каната к лицу', group: 'shoulders', place: 'gym', type: 'iso', sets: 2, reps: [12, 15], step: 2.5,
                    note: 'Лучшее упражнение для здоровья плеч. Тянем к глазам, локти высоко, в конце руки разводим.' },
  g_rear_delt:    { name: 'Обратные разведения в «бабочке»', group: 'shoulders', place: 'gym', type: 'iso', sets: 3, reps: [12, 15], step: 5,
                    note: 'Задняя дельта — укрепляет плечевой сустав.' },
  g_lat_cable:    { name: 'Отведение руки на нижнем блоке', group: 'shoulders', place: 'gym', type: 'iso', sets: 3, reps: [12, 15], step: 1.25,
                    note: 'По одной руке, плавно, до уровня плеча.' },
  g_sh_press:     { name: 'Жим вверх в тренажёре', group: 'shoulders', place: 'gym', type: 'big', sets: 3, reps: [8, 12], step: 5,
                    note: 'Только если левое плечо не болит. При малейшей боли — заменить.' },

  // ---------- ЗАЛ: ПРЕСС ----------
  g_ab_machine:   { name: 'Скручивания в тренажёре', group: 'abs', place: 'gym', type: 'iso', sets: 3, reps: [10, 15], step: 5,
                    note: 'Скручиваемся, а не наклоняемся. Выдох на усилии.' },
  g_captain:      { name: 'Подъём ног в упоре на локтях', group: 'abs', place: 'gym', type: 'body', sets: 3, reps: [10, 15], step: 2.5,
                    note: 'Подкручиваем таз вверх, ноги можно согнуть. Без раскачки.' },
  g_pallof:       { name: 'Удержание блока сбоку (Паллоф)', group: 'abs', place: 'gym', type: 'iso', sets: 2, reps: [10, 12], step: 2.5,
                    note: 'Выпрямляем руки и держим корпус, не давая блоку развернуть. На каждую сторону.' },

  // ---------- ЗАЛ: КОЛЕНО ----------
  g_leg_ext:      { name: 'Разгибание ног в тренажёре (лёгкое)', group: 'knee', place: 'gym', type: 'knee', sets: 2, reps: [15, 20], step: 2.5,
                    note: 'Лёгкий вес, медленно, без рывка в конце. Боль в колене — сразу стоп.' },
  g_leg_curl:     { name: 'Сгибание ног лёжа (лёгкое)', group: 'knee', place: 'gym', type: 'knee', sets: 2, reps: [15, 20], step: 2.5,
                    note: 'Задняя поверхность бедра держит колено стабильным.' },
  g_hip_abd:      { name: 'Отведение ног в тренажёре', group: 'knee', place: 'gym', type: 'knee', sets: 2, reps: [15, 20], step: 5,
                    note: 'Сильные ягодицы снимают нагрузку с колена.' },
  g_calf:         { name: 'Подъём на носки в тренажёре', group: 'knee', place: 'gym', type: 'knee', sets: 2, reps: [15, 20], step: 5,
                    note: 'Колени почти прямые, пауза наверху.' },

  // ---------- ДОМ: ГРУДЬ ----------
  h_floor_press:  { name: 'Жим гантелей лёжа на полу', group: 'chest', place: 'home', type: 'big', sets: 3, reps: [8, 12], step: 2,
                    note: 'Вес — одной гантели. Пол ограничивает глубину — это бережёт левое плечо. Локти касаются пола мягко.' },
  h_floor_fly:    { name: 'Разведение гантелей лёжа на полу', group: 'chest', place: 'home', type: 'iso', sets: 3, reps: [12, 15], step: 1,
                    note: 'Руки чуть согнуты, опускаем до касания пола локтями.' },
  h_pushup:       { name: 'Отжимания от пола', group: 'chest', place: 'home', type: 'body', sets: 3, reps: [12, 25], step: 0,
                    note: 'Корпус прямой. Когда станет легко — опускайся медленно, 3 секунды вниз.' },

  // ---------- ДОМ: СПИНА ----------
  h_row_one:      { name: 'Тяга гантели одной рукой с упором', group: 'back', place: 'home', type: 'big', sets: 3, reps: [8, 12], step: 2,
                    note: 'Упор свободной рукой о стул или диван, ноги стоят, на колено не опираемся. Повторы — на каждую руку.' },
  h_row_two:      { name: 'Тяга двух гантелей в наклоне', group: 'back', place: 'home', type: 'big', sets: 3, reps: [8, 12], step: 2,
                    note: 'Спина ровная, колени слегка согнуты. Тянем к поясу.' },
  h_pullover:     { name: 'Пуловер с гантелью лёжа на полу', group: 'back', place: 'home', type: 'iso', sets: 2, reps: [12, 15], step: 2,
                    note: 'Заводим за голову только до комфортной точки — следим за левым плечом.' },

  // ---------- ДОМ: РУКИ ----------
  h_curl:         { name: 'Подъём гантелей на бицепс', group: 'arms', place: 'home', type: 'iso', sets: 3, reps: [10, 12], step: 1,
                    note: 'С разворотом кисти наружу, без раскачки.' },
  h_hammer:       { name: 'Молотки', group: 'arms', place: 'home', type: 'iso', sets: 3, reps: [10, 12], step: 1,
                    note: 'Ладони смотрят друг на друга. Качает плечевую мышцу — рука толще.' },
  h_skull:        { name: 'Французский жим гантелей лёжа на полу', group: 'arms', place: 'home', type: 'iso', sets: 3, reps: [10, 12], step: 1,
                    note: 'Локти смотрят в потолок и не разъезжаются.' },
  h_kickback:     { name: 'Разгибание руки в наклоне', group: 'arms', place: 'home', type: 'iso', sets: 3, reps: [12, 15], step: 1,
                    note: 'Плечо параллельно полу, двигается только предплечье.' },
  h_close_push:   { name: 'Отжимания узким хватом', group: 'arms', place: 'home', type: 'body', sets: 2, reps: [8, 20], step: 0,
                    note: 'Ладони под плечами, локти вдоль корпуса.' },

  // ---------- ДОМ: ПЛЕЧИ ----------
  h_lateral:      { name: 'Махи гантелями в стороны', group: 'shoulders', place: 'home', type: 'iso', sets: 3, reps: [12, 15], step: 1,
                    note: 'До уровня плеч, не выше. Лёгкий наклон вперёд.' },
  h_rear_fly:     { name: 'Разведение гантелей в наклоне', group: 'shoulders', place: 'home', type: 'iso', sets: 2, reps: [12, 15], step: 1,
                    note: 'Задняя дельта. Лёгкий вес, сводим лопатки.' },
  h_ext_rot:      { name: 'Наружная ротация плеча лёжа на боку', group: 'shoulders', place: 'home', type: 'iso', sets: 2, reps: [15, 20], step: 0.5,
                    note: 'Укрепляет связки плеча. Очень лёгкая гантель, локоть прижат к боку. Делать обе руки.' },

  // ---------- ДОМ: ПРЕСС ----------
  h_plank:        { name: 'Планка', group: 'abs', place: 'home', type: 'time', sets: 3, reps: [30, 60], step: 0,
                    note: 'В поле «повторы» — секунды. Таз не провисает.' },
  h_rev_crunch:   { name: 'Обратные скручивания', group: 'abs', place: 'home', type: 'body', sets: 3, reps: [12, 15], step: 0,
                    note: 'Подкручиваем таз к груди, а не машем ногами.' },
  h_crunch:       { name: 'Скручивания на коврике', group: 'abs', place: 'home', type: 'body', sets: 3, reps: [15, 20], step: 0,
                    note: 'Поясница прижата, отрываем только лопатки. Гантель на грудь, когда станет легко.' },
  h_deadbug:      { name: '«Мёртвый жук»', group: 'abs', place: 'home', type: 'body', sets: 2, reps: [10, 12], step: 0,
                    note: 'Поясница прижата к полу всё время. Повторы — на каждую сторону.' },

  // ---------- ДОМ: КОЛЕНО ----------
  h_slr:          { name: 'Подъём прямой ноги лёжа', group: 'knee', place: 'home', type: 'knee', sets: 2, reps: [15, 20], step: 0,
                    note: 'Напряги бедро, подними прямую ногу на 30–40 см, пауза 2 секунды. Обе ноги.' },
  h_bridge:       { name: 'Ягодичный мостик', group: 'knee', place: 'home', type: 'knee', sets: 2, reps: [15, 20], step: 2,
                    note: 'Гантель на таз. Пауза наверху. Колени над стопами.' },
  h_side_leg:     { name: 'Отведение ноги лёжа на боку', group: 'knee', place: 'home', type: 'knee', sets: 2, reps: [15, 20], step: 0,
                    note: 'Носок смотрит вперёд, не задирай вверх. Обе ноги.' },
  h_calf:         { name: 'Подъём на носки стоя', group: 'knee', place: 'home', type: 'knee', sets: 2, reps: [15, 20], step: 2,
                    note: 'С гантелью в руке, держась за стену. Пауза наверху.' },
};

// Сами тренировки. Идут по кругу: Зал А → Дом А → Зал Б → Дом Б.
const DEFAULT_PROGRAM = [
  { id: 'gymA', name: 'Зал А', subtitle: 'Грудь и спина', place: 'gym',
    exercises: ['g_incline_db', 'g_lat_pulldown', 'g_chest_press', 'g_cable_row', 'g_face_pull', 'g_ab_machine', 'g_leg_ext', 'g_hip_abd'] },
  { id: 'homeA', name: 'Дом А', subtitle: 'Руки, плечи, грудь', place: 'home',
    exercises: ['h_floor_press', 'h_row_one', 'h_curl', 'h_skull', 'h_lateral', 'h_ext_rot', 'h_plank', 'h_slr', 'h_bridge'] },
  { id: 'gymB', name: 'Зал Б', subtitle: 'Спина, грудь, руки', place: 'gym',
    exercises: ['g_pullup', 'g_bench', 'g_tbar', 'g_fly_cable', 'g_ez_curl', 'g_pushdown', 'g_captain', 'g_leg_curl', 'g_calf'] },
  { id: 'homeB', name: 'Дом Б', subtitle: 'Грудь, спина, руки', place: 'home',
    exercises: ['h_pushup', 'h_row_two', 'h_floor_fly', 'h_pullover', 'h_hammer', 'h_kickback', 'h_rear_fly', 'h_rev_crunch', 'h_side_leg', 'h_calf'] },
];
