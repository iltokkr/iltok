import React, { useMemo, useState, useEffect } from 'react';
import styles from '@/styles/JobFilter.module.css';
import { gtag } from '@/lib/gtag';

interface FilterOptions {
  city1: string;
  city2: string;
  cate1: string;
  cate2: string;
  keyword: string;
  searchType: 'title' | 'contents' | 'both';
}

interface JobFilterProps {
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

const JobFilter: React.FC<JobFilterProps> = ({ 
  filters, 
  onFilterChange, 
  city2Options, 
  cate2Options 
}) => {
  const [searchInput, setSearchInput] = useState({
    keyword: filters.keyword || '',
    searchType: filters.searchType || 'both'
  });

  useEffect(() => {
    setSearchInput({
      keyword: filters.keyword || '',
      searchType: filters.searchType || 'both'
    });
  }, [filters.keyword, filters.searchType]);

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    gtag('event', 'filter_change', {
      event_category: 'filter',
      event_label: `${name}_change`,
      value: value
    });
    onFilterChange({ ...filters, [name]: value });
  };

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    const { name, value } = e.target;
    setSearchInput(prev => ({ ...prev, [name]: value }));
  };

  const handleSearch = (e: React.MouseEvent) => {
    e.preventDefault();
    gtag('event', 'search_button_click', {
      event_category: 'search',
      event_label: searchInput.searchType,
      value: searchInput.keyword
    });
    onFilterChange({
      ...filters,
      keyword: searchInput.keyword,
      searchType: searchInput.searchType
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      gtag('event', 'search_button_click', {
        event_category: 'search',
        event_label: 'enter_key',
        value: searchInput.keyword
      });
      onFilterChange({
        ...filters,
        keyword: searchInput.keyword,
        searchType: searchInput.searchType
      });
    }
  };

  const city1Options = useMemo(() => Object.keys(locations), []);

  const currentCity2Options = useMemo(() => {
    return filters.city1 ? locations[filters.city1] : [];
  }, [filters.city1]);

  return (
    <div className={styles.searchBar}>
      <form name="search_form" id="search_form" action="/board" method="get" onSubmit={(e) => e.preventDefault()}>
        <input name="bo_mode" type="hidden" id="bo_mode" value="list" />
        <input name="bo_table" type="hidden" id="bo_table" value="job" />
        
        <ul className={styles.filterBar}>
          <li className={styles.selectBox}>       
            <select name="city1" id="city1" value={filters.city1} onChange={handleFilterChange}>
              <option value="">전국</option>
              {city1Options.map((city, index) => (
                <option key={index} value={city}>{city}</option>
              ))}
            </select>
          </li>
          <li className={styles.selectBox}>
            <select name="city2" id="city2" value={filters.city2} onChange={handleFilterChange}>
              <option value="">시/구/군</option>
              {currentCity2Options.map((city, index) => (
                <option key={index} value={city}>{city}</option>
              ))}
            </select>
          </li>
          <li className={styles.selectBox}>
            <select name="cate1" id="cate1" value={filters.cate1} onChange={handleFilterChange}>
              <option value="">분류선택</option>
              <option value="교육·강사">교육·강사</option>
              <option value="사무직">사무직</option>
              <option value="판매·영업">판매·영업</option>
              <option value="생산·건설">생산·건설</option>
              <option value="서비스직·음식">서비스직·음식</option>
              <option value="IT·디자인">IT·디자인</option>
              <option value="운전">운전</option>
            </select>
          </li>
          <li className={styles.selectBox}>
            <select name="cate2" id="cate2" value={filters.cate2} onChange={handleFilterChange}>
              <option value="">소분류선택</option>
              {cate2Options.map((option, index) => (
                <option key={index} value={option}>{option}</option>
              ))}
            </select>
          </li>
        </ul>

        <div className={styles.searchForm}>
          <select
            name="searchType"
            value={searchInput.searchType}
            onChange={handleSearchInputChange}
            className={styles.searchType}
          >
            <option value="both">제목+내용</option>
            <option value="title">제목만</option>
            <option value="contents">내용만</option>
          </select>
          <input 
            className={styles.searchInput} 
            type="text" 
            name="keyword" 
            value={searchInput.keyword}
            onChange={handleSearchInputChange}
            placeholder="검색어를 입력하세요"
            onKeyPress={handleKeyPress}
          />
          <button 
            className={styles.searchButton} 
            type="button" 
            onClick={handleSearch}
          >
            검색
          </button>
        </div>
      </form>
    </div>
  );
};

export default JobFilter;
