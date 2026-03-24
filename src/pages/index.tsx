import { GetServerSideProps } from 'next';

export const getServerSideProps: GetServerSideProps = async () => {
  return {
    redirect: {
      destination: '/board',
      permanent: true,
    },
  };
};

export default function Home() {
  return null;
}
