import React, { useMemo } from 'react';
import styles from '@/styles/JobFilter.module.css';
import { gtag } from '@/lib/gtag';
import { HiLocationMarker } from 'react-icons/hi';
import SelectDropdown from './SelectDropdown';

interface FilterOptions {
  city1: string;
  city2: string;
  cate1: string;
  cate2: string;
  keyword: string;
  searchType: 'title' | 'contents' | 'both';
}

interface JobFilterProps {
  boardType?: string;
  filters: FilterOptions;
  onFilterChange: (newFilters: FilterOptions) => void;
  city2Options: string[];
  cate2Options: string[];
}

const locations: { [key: string]: string[] } = {
  서울: ["종로구", "중구", "용산구", "성동구", "광진구", "동대문구", "중랑구", "성북구", "강북구", "도봉구", "노원구", "은평구", "서대문구", "마포구", "양천구", "강서구", "구로구", "금천구", "영등포구", "동작구", "관악구", "서초구", "강남구", "송파구","강동구"],
  부산: ["중구", "서구", "동구", "영도구", "부산진구", "동래구", "남구", "북구", "해운대구", "사하구", "금정구", "강서구", "연제구", "수영구", "사상구", "기장군"],
  대구: ["중구", "동구", "서구", "남구", "북구", "수성구", "달서구", "달성군"],
  인천: ["중구", "동구", "남구", "미추홀구", "연수구", "남동구", "부평구", "계양구", "서구", "강화군", "옹진군"],
  광주: ["동구", "서구", "남구", "북구", "광산구"],
  대전: ["동구", "중구", "서구", "유성구", "대덕구"],
  울산: ["중구", "남구", "동구", "북구", "울주군"],
  세종: [""],
  경기: ["수원시", "성남시", "고양시", "용인시", "부천시", "안산시", "안양시", "남양주시", "화성시", "평택시", "의정부시", "시흥시", "파주시", "광명시", "김포시", "군포시", "광주시", "이천시", "양주시", "오산시", "구리시", "안성시", "포천시", "의왕시", "하남시", "여주시", "여주군", "양평군", "동두천시", "과천시", "가평군", "연천군"],
  강원: ["춘천시", "원주시", "강릉시", "동해시", "태백시", "속초시", "삼척시", "홍천군", "횡성군", "영월군", "평창군", "정선군", "철원군", "화천군", "양구군", "인제군", "고성군", "양양군"],
  충북: ["청주시", "충주시", "제천시", "청원군", "보은군", "옥천군", "영동군", "진천군", "괴산군", "음성군", "단양군", "증평군"],
  충남: ["천안시", "공주시", "보령시", "아산시", "서산시", "논산시", "계룡시", "당진시", "당진군", "금산군", "연기군", "부여군", "서천군", "청양군", "홍성군", "예산군", "태안군"],
  전북: ["전주시", "군산시", "익산시", "정읍시", "남원시", "김제시", "완주군", "진안군", "무주군", "장수군", "임실군", "순창군", "고창군", "부안군"],
  전남: ["목포시", "여수시", "순천시", "나주시", "광양시", "담양군", "곡성군", "구례군", "고흥군", "보성군", "화순군", "장흥군", "강진군", "해남군", "영암군", "무안군", "함평군", "영광군", "장성군", "완도군", "진도군", "신안군"],
  경북: ["포항시", "경주시", "김천시", "안동시", "구미시", "영주시", "영천시", "상주시", "문경시", "경산시", "군위군", "의성군", "청송군", "영양군", "영덕군", "청도군", "고령군", "성주군", "칠곡군", "예천군", "봉화군", "울진군", "울릉군"],
  경남: ["창원시", "마산시", "진주시", "진해시", "통영시", "사천시", "김해시", "밀양시", "거제시", "양산시", "의령군", "함안군", "창녕군", "고성군", "남해군", "하동군", "산청군", "함양군", "거창군", "합천군"],
  제주: ["제주시", "서귀포시", "북제주군", "남제주군"]
};

// IT·디자인, 교육·강사 제외 (채용정보 필터용)
const CATEGORY_OPTIONS = [
  '생산·건설',
  '서비스직·음식',
  '사무직',
  '판매·영업',
  '운전'
] as const;

const categories: { [key: string]: string[] } = {
  "교육·강사": ["학습지교사", "학원강사", "방과후교사", "전문강사"],
  "사무직": ["일반사무", "경리", "회계", "인사"],
  "판매·영업": ["매장관리", "판매", "영업", "텔레마케터"],
  "생산·건설": ["생산직", "건설", "기술직", "노무직"],
  "서비스직·음식": ["서빙", "요리", "미용", "숙박"],
  "운전": ["택시", "버스", "화물", "배달"]
};

interface RegionDropdownProps {
  placeholder: string;
  value: string;
  options: { value: string; label: string }[];
  onSelect: (value: string) => void;
  icon?: React.ReactNode;
}

const RegionDropdown: React.FC<RegionDropdownProps> = ({
  placeholder,
  value,
  options,
  onSelect,
  icon
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const displayLabel = value ? options.find((o) => o.value === value)?.label ?? placeholder : placeholder;

  return (
    <div className={styles.regionDropdown} ref={ref}>
      <button
        type="button"
        className={`${styles.regionTrigger} ${isOpen ? styles.regionTriggerOpen : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        {icon && <span className={styles.regionIcon}>{icon}</span>}
        <span className={styles.regionTriggerText}>{displayLabel}</span>
        <span className={styles.regionChevron}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
      </button>
      {isOpen && (
        <div className={styles.regionPanel}>
          <ul className={styles.regionList} role="listbox">
            {options.map((opt) => (
              <li key={opt.value || 'empty'}>
                <button
                  type="button"
                  role="option"
                  aria-selected={value === opt.value}
                  className={`${styles.regionOption} ${value === opt.value ? styles.regionOptionActive : ''}`}
                  onClick={() => {
                    onSelect(opt.value);
                    setIsOpen(false);
                  }}
                >
                  {opt.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

const JobFilter: React.FC<JobFilterProps> = ({ 
  boardType = '0',
  filters, 
  onFilterChange, 
  city2Options, 
  cate2Options 
}) => {
  // 채용정보(board_type 0)에만 새 필터 디자인 적용
  if (boardType !== '0') {
    return null;
  }

  const handleFilterChange = (name: string, value: string) => {
    gtag('event', 'filter_change', {
      event_category: 'filter',
      event_label: `${name}_change`,
      value: value
    });
    const next = { ...filters, [name]: value };
    if (name === 'city1') next.city2 = '';
    if (name === 'cate1') next.cate2 = '';
    onFilterChange(next);
  };

  // 광고/공고 많은 지역 TOP5 (데이터 기준: 경기, 서울, 인천, 충남, 충북)
const TOP_REGIONS = ['경기', '서울', '인천', '충남', '충북'];

const city1Options = useMemo(() => {
  const all = Object.keys(locations);
  const top = TOP_REGIONS.filter((r) => all.includes(r));
  const rest = all.filter((r) => !TOP_REGIONS.includes(r));
  return [...top, ...rest];
}, []);

  const currentCity2Options = useMemo(() => {
    return filters.city1 ? locations[filters.city1].filter(Boolean) : [];
  }, [filters.city1]);

  const currentCate2Options = useMemo(() => {
    return filters.cate1 && categories[filters.cate1] ? categories[filters.cate1] : [];
  }, [filters.cate1]);

  return (
    <div className={styles.filterWrapper}>
      {/* 지역 필터 - 트렌디 커스텀 드롭다운 */}
      <section className={styles.regionSection}>
        <span className={styles.sectionLabel}>지역</span>
        <div className={styles.regionSelects}>
          <SelectDropdown
            placeholder="전국"
            value={filters.city1}
            options={[{ value: '', label: '전국' }, ...city1Options.map((c) => ({ value: c, label: c }))]}
            onSelect={(v) => handleFilterChange('city1', v)}
            icon={<HiLocationMarker />}
          />
          {filters.city1 && currentCity2Options.length > 0 && (
            <SelectDropdown
              placeholder="전체"
              value={filters.city2}
              options={[{ value: '', label: '전체' }, ...currentCity2Options.map((c) => ({ value: c, label: c }))]}
              onSelect={(v) => handleFilterChange('city2', v)}
            />
          )}
        </div>
      </section>

      {/* 분류 필터 - 칩 버튼 */}
      <section className={styles.categorySection}>
        <span className={styles.sectionLabel}>분류</span>
        <div className={styles.categoryChips}>
          <button
            type="button"
            className={`${styles.chip} ${!filters.cate1 ? styles.chipActive : ''}`}
            onClick={() => handleFilterChange('cate1', '')}
          >
            전체
          </button>
          {CATEGORY_OPTIONS.map((cate) => (
            <button
              key={cate}
              type="button"
              className={`${styles.chip} ${filters.cate1 === cate ? styles.chipActive : ''}`}
              onClick={() => handleFilterChange('cate1', cate)}
            >
              {cate}
            </button>
          ))}
        </div>
        {filters.cate1 && currentCate2Options.length > 0 && (
          <div className={styles.subCategoryChips}>
            <button
              type="button"
              className={`${styles.chip} ${styles.chipSmall} ${!filters.cate2 ? styles.chipActive : ''}`}
              onClick={() => handleFilterChange('cate2', '')}
            >
              전체
            </button>
            {currentCate2Options.map((sub) => (
              <button
                key={sub}
                type="button"
                className={`${styles.chip} ${styles.chipSmall} ${filters.cate2 === sub ? styles.chipActive : ''}`}
                onClick={() => handleFilterChange('cate2', sub)}
              >
                {sub}
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default JobFilter;
