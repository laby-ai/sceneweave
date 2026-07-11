import { getObjectStorageReadiness } from './runtime-readiness';

export const FILM_COMPOSE_STORAGE_NOT_READY = 'film_compose_storage_not_ready';

export interface FilmComposeDurabilityReadiness {
  ready: boolean;
  code?: typeof FILM_COMPOSE_STORAGE_NOT_READY;
  message: string;
  retryable: boolean;
  clipsPreserved: boolean;
}

export function getFilmComposeDurabilityReadiness(): FilmComposeDurabilityReadiness {
  const storage = getObjectStorageReadiness();
  if (storage.ready) {
    return {
      ready: true,
      message: '最终成片可保存到持久对象存储。',
      retryable: false,
      clipsPreserved: true,
    };
  }

  return {
    ready: false,
    code: FILM_COMPOSE_STORAGE_NOT_READY,
    message: '最终成片暂时无法稳定保存。已生成镜头均已保留，请稍后重试。',
    retryable: true,
    clipsPreserved: true,
  };
}
