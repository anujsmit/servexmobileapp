import React, { createContext, useContext, useState, ReactNode } from 'react';

export type SearchContextData = {
    isSearching: boolean;
    requestId: string | null;
    serviceType: string | null;
    startSearch: (requestId: string, serviceType: string) => void;
    cancelSearch: () => void;
};

const SearchContext = createContext<SearchContextData>({} as SearchContextData);

export const SearchProvider = ({ children }: { children: ReactNode }) => {
    const [isSearching, setIsSearching] = useState<boolean>(false);
    const [requestId, setRequestId] = useState<string | null>(null);
    const [serviceType, setServiceType] = useState<string | null>(null);

    const startSearch = (id: string, type: string) => {
        setIsSearching(true);
        setRequestId(id);
        setServiceType(type);
    };

    const cancelSearch = () => {
        setIsSearching(false);
        setRequestId(null);
        setServiceType(null);
    };

    return (
        <SearchContext.Provider value={{ isSearching, requestId, serviceType, startSearch, cancelSearch }}>
            {children}
        </SearchContext.Provider>
    );
};

export const useSearch = () => useContext(SearchContext);
