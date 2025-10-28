import type { GetServerSideProps } from "next";

export const getServerSideProps: GetServerSideProps = async () => {
  return {
    redirect: { destination: "/reportes", permanent: false },
  };
};

export default function Index() {
  return null;
}
